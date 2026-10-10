import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rupeesToPaise } from "@/lib/money";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { getOrderPayments, isCashfreeConfigured, type CfPayment } from "@/lib/payments/cashfree";

export type SyncResult = "paid" | "already_paid" | "pending" | "failed" | "amount_mismatch" | "needs_refund" | "not_found" | "not_configured";

/**
 * Source of truth for "was this order paid?": asks Cashfree (Get Payments for
 * the order) and applies the result idempotently. Used by the return page,
 * the webhook handler and the expiry cron, so a missed webhook or a closed
 * browser tab can never lose a payment.
 */
export async function syncOrderPayment(orderNumber: string, actor = "cashfree"): Promise<SyncResult> {
  if (!isCashfreeConfigured()) return "not_configured";
  const supabase = createAdminClient();

  const payments = await getOrderPayments(orderNumber);
  const success = payments.find((p) => p.payment_status === "SUCCESS");

  // Record failed / dropped attempts for the admin timeline.
  for (const p of payments.filter((x) => x !== success && x.cf_payment_id)) {
    await supabase.rpc("record_payment", {
      p_order_number: orderNumber,
      p_cf_payment_id: String(p.cf_payment_id),
      p_amount: rupeesToPaise(p.payment_amount),
      p_status: p.payment_status,
      p_method: p.payment_group ?? "",
      p_raw: p as unknown as never,
    });
  }

  if (!success) {
    return payments.some((p) => p.payment_status === "PENDING") ? "pending" : payments.length ? "failed" : "pending";
  }

  const { data, error } = await supabase.rpc("mark_order_paid", {
    p_order_number: orderNumber,
    p_cf_payment_id: String(success.cf_payment_id),
    p_amount: rupeesToPaise(success.payment_amount),
    p_method: success.payment_group ?? "",
    p_raw: success as unknown as never,
    p_actor: actor,
  });
  if (error) throw new Error(`mark_order_paid failed: ${error.message}`);
  const result = data as SyncResult;

  if (result === "paid") {
    const { data: order } = await supabase.from("orders").select("id").eq("order_number", orderNumber).single();
    if (order) after(() => sendOrderEmail(order.id, "paid"));
  }
  if (result === "needs_refund" || result === "amount_mismatch") {
    console.warn(`[payments] ${orderNumber}: ${result}, flagged for admin refund`);
  }
  return result;
}

export type { CfPayment };
