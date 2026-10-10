"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { initiateRefund } from "@/lib/payments/refunds";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { syncOrderPayment } from "@/lib/payments/sync";
import { rupeesToPaise } from "@/lib/money";
import { fieldErrors, type FormState } from "@/lib/validation/auth";

type Result = { ok: boolean; message: string };
const uuid = z.uuid();

function done(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

const STATUS_ERRORS: Record<string, string> = {
  INVALID_TRANSITION: "That status change isn't allowed from the current status.",
  NOT_SHIPPABLE: "Only confirmed or packed orders can be shipped.",
  NOT_CANCELLABLE: "This order can't be cancelled at its current status.",
  ACTIVE_SHIPMENT: "Cancel the shipment with the courier first.",
};
const friendly = (msg: string, fallback: string) => STATUS_ERRORS[Object.keys(STATUS_ERRORS).find((k) => msg.includes(k)) ?? ""] ?? fallback;

/** confirmed → processing, shipped → delivered / rto, delivered|rto → returned. */
export async function updateOrderStatus(orderId: string, status: "processing" | "delivered" | "rto" | "returned"): Promise<Result> {
  const user = await requirePermission("orders.manage");
  if (!uuid.safeParse(orderId).success || !["processing", "delivered", "rto", "returned"].includes(status)) return { ok: false, message: "Invalid request." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("set_order_status", { p_order_id: orderId, p_status: status, p_actor: `staff:${user.id}`, p_note: `Marked ${status} by ${user.fullName ?? "staff"}` });
  if (error) return { ok: false, message: friendly(error.message, "Couldn't update the status.") };

  if (status === "delivered") {
    const { data: s } = await admin.from("shipments").select("id").eq("order_id", orderId).eq("is_active", true).maybeSingle();
    if (s) await admin.rpc("add_shipment_event", { p_shipment_id: s.id, p_status: "delivered", p_location: "", p_description: "Delivered", p_occurred_at: new Date().toISOString(), p_actor: `staff:${user.id}` });
    after(() => sendOrderEmail(orderId, "delivered"));
  }
  done(orderId);
  return { ok: true, message: "Order updated." };
}

const shipSchema = z.object({
  orderId: z.uuid(),
  courier: z.string().trim().min(2, "Enter the courier name").max(60),
  awb: z.string().trim().min(4, "Enter the AWB / tracking number").max(40),
  trackingUrl: z.union([z.literal(""), z.url("Enter a valid URL")]).optional(),
});

/** Manual shipment until the Shipmozo integration is connected. */
export async function markShipped(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("shipments.manage");
  const parsed = shipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { orderId, courier, awb, trackingUrl } = parsed.data;

  const { error } = await createAdminClient().rpc("create_shipment", {
    p_order_id: orderId,
    p_provider: "manual",
    p_courier_name: courier,
    p_awb: awb,
    p_tracking_url: trackingUrl ?? "",
    p_actor: `staff:${user.id}`,
  });
  if (error) {
    if (error.message.includes("shipments_awb_key")) return { fieldErrors: { awb: ["This AWB is already used on another shipment"] } };
    return { message: friendly(error.message, "Couldn't create the shipment.") };
  }
  after(() => sendOrderEmail(orderId, "shipped", { courier, awb, trackingUrl: trackingUrl || null }));
  done(orderId);
  return { ok: true, message: "Marked as shipped. The customer has been emailed." };
}

const eventSchema = z.object({
  orderId: z.uuid(),
  shipmentId: z.uuid(),
  status: z.enum(["in_transit", "out_for_delivery", "delivered", "rto", "delayed"]),
  location: z.string().trim().max(80).optional(),
  description: z.string().trim().max(200).optional(),
});

export async function addTrackingUpdate(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("shipments.manage");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { orderId, shipmentId, status, location, description } = parsed.data;
  const label = { in_transit: "In transit", out_for_delivery: "Out for delivery", delivered: "Delivered", rto: "Returning to origin", delayed: "Delayed" }[status];

  const { error } = await createAdminClient().rpc("add_shipment_event", {
    p_shipment_id: shipmentId,
    p_status: status,
    p_location: location ?? "",
    p_description: description || label,
    p_occurred_at: new Date().toISOString(),
    p_actor: `staff:${user.id}`,
  });
  if (error) return { message: "Couldn't add the update." };
  if (status === "delivered") after(() => sendOrderEmail(orderId, "delivered"));
  done(orderId);
  return { ok: true, message: "Tracking updated." };
}

/** Cancels, restocks and (for admins) refunds prepaid payments automatically. */
export async function adminCancelOrder(orderId: string, reason: string): Promise<Result> {
  const user = await requirePermission("orders.manage");
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
  const note = reason.trim().slice(0, 200) || "Cancelled by store";

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cancel_order", { p_order_id: orderId, p_actor: `staff:${user.id}`, p_reason: note });
  if (error) return { ok: false, message: friendly(error.message, "Couldn't cancel the order.") };
  await admin.rpc("audit", { p_actor: user.id, p_action: "order.cancelled", p_entity: "order", p_entity_id: orderId, p_details: { reason: note } });

  const refundDue = (data as { refund_due: number }).refund_due;
  let message = "Order cancelled and stock returned.";
  if (refundDue > 0) {
    if (can(user.role, "refunds.manage")) {
      const r = await initiateRefund(orderId, refundDue, note, `staff:${user.id}`);
      message += r.ok ? ` Refund ${r.status === "success" ? "completed" : "initiated"}.` : ` Refund failed: ${r.message}`;
    } else {
      await admin.from("orders").update({ needs_refund: true }).eq("id", orderId);
      message += " An admin needs to issue the refund.";
    }
  }
  after(() => sendOrderEmail(orderId, "cancelled"));
  done(orderId);
  return { ok: true, message };
}

const refundSchema = z.object({
  orderId: z.uuid(),
  amount: z.coerce.number().positive("Enter an amount").max(10_000_000),
  reason: z.string().trim().min(3, "Add a short reason").max(100),
});

export async function refundOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("refunds.manage");
  const parsed = refundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { orderId, amount, reason } = parsed.data;

  const r = await initiateRefund(orderId, rupeesToPaise(amount), reason, `staff:${user.id}`);
  if (!r.ok) return { message: r.message };
  await createAdminClient().rpc("audit", {
    p_actor: user.id,
    p_action: "refund.created",
    p_entity: "order",
    p_entity_id: orderId,
    p_details: { amount_paise: rupeesToPaise(amount), reason, refund_id: r.refundId, status: r.status },
  });
  done(orderId);
  revalidatePath("/admin/refunds");
  return {
    ok: true,
    message: isCashfreeConfigured() ? `Refund ${r.refundId} ${r.status === "success" ? "completed" : "submitted to Cashfree"}.` : `Refund ${r.refundId} recorded as pending. Cashfree isn't configured yet.`,
  };
}

export async function saveAdminNote(orderId: string, note: string): Promise<Result> {
  await requirePermission("orders.manage");
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
  const { error } = await createAdminClient().from("orders").update({ admin_note: note.slice(0, 2000) || null }).eq("id", orderId);
  done(orderId);
  return { ok: !error, message: error ? "Couldn't save the note." : "Note saved." };
}

export async function recheckPayment(orderId: string): Promise<Result> {
  await requirePermission("orders.manage");
  if (!isCashfreeConfigured()) return { ok: false, message: "Cashfree isn't configured yet." };
  const { data: order } = await createAdminClient().from("orders").select("order_number").eq("id", orderId).single();
  if (!order) return { ok: false, message: "Order not found." };
  try {
    const r = await syncOrderPayment(order.order_number, "staff");
    done(orderId);
    return { ok: true, message: `Payment status: ${r.replace(/_/g, " ")}.` };
  } catch {
    return { ok: false, message: "Couldn't reach Cashfree." };
  }
}

export async function clearNeedsRefund(orderId: string): Promise<Result> {
  const user = await requirePermission("refunds.manage");
  const admin = createAdminClient();
  const { error } = await admin.from("orders").update({ needs_refund: false }).eq("id", orderId);
  await admin.rpc("audit", { p_actor: user.id, p_action: "refund.flag_cleared", p_entity: "order", p_entity_id: orderId });
  done(orderId);
  revalidatePath("/admin/refunds");
  return { ok: !error, message: error ? "Couldn't update." : "Marked as resolved." };
}
