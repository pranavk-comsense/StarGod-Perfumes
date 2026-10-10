import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { getRefund, isCashfreeConfigured, mapRefundStatus } from "@/lib/payments/cashfree";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { syncOrderPayment } from "@/lib/payments/sync";

/**
 * Releases stock held by unpaid prepaid orders. Before expiring an order we ask
 * Cashfree whether it was paid (a webhook may have been missed), so a paid
 * order is never cancelled. Scheduled in vercel.json; authenticated with
 * CRON_SECRET (Vercel sends "Authorization: Bearer <CRON_SECRET>").
 */
export async function GET(request: NextRequest) {
  const secret = serverEnv().CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const graceCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("status", "pending_payment")
    .lt("reserved_until", graceCutoff)
    .order("reserved_until")
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = { checked: orders?.length ?? 0, paid: 0, expired: 0, errors: 0 };
  for (const o of orders ?? []) {
    try {
      if (isCashfreeConfigured()) {
        const r = await syncOrderPayment(o.order_number, "cron");
        if (r === "paid" || r === "already_paid" || r === "needs_refund" || r === "amount_mismatch") {
          result.paid++;
          continue;
        }
        if (r === "pending") continue; // payment in flight; check again next run
      }
      const { data: expired } = await supabase.rpc("expire_order_hold", { p_order_id: o.id });
      if (expired) result.expired++;
    } catch (e) {
      result.errors++;
      console.error("[cron] expire", o.order_number, e);
    }
  }
  // Refunds: if a refund webhook was missed, poll Cashfree for refunds still pending after 10 minutes.
  const refunds = { checked: 0, settled: 0 };
  if (isCashfreeConfigured()) {
    const { data: pending } = await supabase
      .from("refunds")
      .select("refund_id, order_id, amount, orders(order_number)")
      .eq("status", "pending")
      .not("cf_refund_id", "is", null)
      .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(50);
    for (const r of pending ?? []) {
      refunds.checked++;
      const orderNumber = (r.orders as { order_number: string } | null)?.order_number;
      if (!orderNumber) continue;
      try {
        const cf = await getRefund(orderNumber, r.refund_id);
        const status = mapRefundStatus(cf.refund_status);
        if (status === "pending") continue;
        await supabase.rpc("apply_refund_status", { p_refund_id: r.refund_id, p_status: status, p_cf_refund_id: String(cf.cf_refund_id), p_raw: cf as never });
        if (status === "success") await sendOrderEmail(r.order_id, "refunded", { refundAmount: r.amount });
        refunds.settled++;
      } catch (e) {
        console.error("[cron] refund", r.refund_id, e);
      }
    }
  }

  return NextResponse.json({ ...result, refunds });
}
