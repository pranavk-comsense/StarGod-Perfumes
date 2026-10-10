"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { initiateRefund } from "@/lib/payments/refunds";
import { getOrderDetail, customerCanCancel } from "@/lib/orders/queries";
import { CANCEL_REASONS } from "@/lib/orders/format";


export async function cancelMyOrder(orderNumber: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!z.string().max(40).safeParse(orderNumber).success) return { ok: false, message: "Order not found." };
  if (!(await rateLimit(`cancel:${user.id}`, 10, 3600))) return { ok: false, message: "Too many attempts. Please try later." };

  const supabase = await createClient();
  const order = await getOrderDetail(supabase, { orderNumber });
  if (!order || order.user_id !== user.id) return { ok: false, message: "Order not found." };
  if (!customerCanCancel(order)) return { ok: false, message: "This order can no longer be cancelled. Please contact support." };

  const why = (CANCEL_REASONS as readonly string[]).includes(reason) ? reason : "Other";
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cancel_order", { p_order_id: order.id, p_actor: `customer:${user.id}`, p_reason: `Cancelled by customer: ${why}` });
  if (error) {
    console.error("[orders] cancel", error.message);
    return { ok: false, message: "Couldn't cancel the order. Please contact support." };
  }

  const refundDue = (data as { refund_due: number }).refund_due;
  let message = "Your order has been cancelled.";
  if (refundDue > 0) {
    const r = await initiateRefund(order.id, refundDue, "Customer cancellation", `customer:${user.id}`);
    message += r.ok ? " Your refund has been initiated and usually arrives in 5–7 business days." : " Our team will process your refund shortly.";
  }
  after(() => sendOrderEmail(order.id, "cancelled"));
  revalidatePath(`/account/orders/${orderNumber}`);
  return { ok: true, message };
}
