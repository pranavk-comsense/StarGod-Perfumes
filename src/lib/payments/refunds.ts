import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { createRefund, isCashfreeConfigured, mapRefundStatus } from "@/lib/payments/cashfree";

export type RefundOutcome = { ok: true; status: "pending" | "success" | "failed"; refundId: string } | { ok: false; message: string };

const ERRORS: Record<string, string> = {
  NOT_REFUNDABLE: "This order has no online payment to refund.",
  REFUND_EXCEEDS_PAID: "The refund is more than the amount paid.",
  INVALID_AMOUNT: "Enter a valid refund amount.",
};

/**
 * Creates our refund record (which enforces "never more than paid"), then asks
 * Cashfree to refund. Without Cashfree credentials the refund stays pending
 * and the order is flagged so an admin can process it once keys are added.
 */
export async function initiateRefund(orderId: string, amountPaise: number, reason: string, actor: string): Promise<RefundOutcome> {
  const supabase = createAdminClient();
  const { data: refund, error } = await supabase.rpc("create_refund", {
    p_order_id: orderId,
    p_amount: amountPaise,
    p_reason: reason,
    p_actor: actor,
  });
  if (error || !refund) {
    const key = Object.keys(ERRORS).find((k) => error?.message.includes(k));
    if (!key) console.error("[refund] create_refund", error?.message);
    return { ok: false, message: key ? ERRORS[key] : "Couldn't create the refund." };
  }

  const { data: order } = await supabase.from("orders").select("order_number").eq("id", orderId).single();

  if (!isCashfreeConfigured() || !order) {
    await supabase.from("orders").update({ needs_refund: true }).eq("id", orderId);
    return { ok: true, status: "pending", refundId: refund.refund_id };
  }

  try {
    const cf = await createRefund(order.order_number, { refundId: refund.refund_id, amountPaise, note: reason });
    const status = mapRefundStatus(cf.refund_status);
    await supabase.rpc("apply_refund_status", {
      p_refund_id: refund.refund_id,
      p_status: status,
      p_cf_refund_id: String(cf.cf_refund_id),
      p_raw: cf as unknown as never,
    });
    if (status === "success") after(() => sendOrderEmail(orderId, "refunded", { refundAmount: amountPaise }));
    return { ok: true, status, refundId: refund.refund_id };
  } catch (e) {
    console.error("[refund] cashfree", e);
    await supabase.rpc("apply_refund_status", { p_refund_id: refund.refund_id, p_status: "failed", p_cf_refund_id: "", p_raw: { error: String(e) } });
    await supabase.from("orders").update({ needs_refund: true }).eq("id", orderId);
    return { ok: false, message: "The payment gateway rejected the refund. It's been flagged for manual follow-up." };
  }
}
