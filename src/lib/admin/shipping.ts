"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookOrder, bookReturn, cancelReturn, cancelShipment, quoteOrder, syncActiveShipments, syncReturns, syncTracking } from "@/lib/shipping/booking";
import { createWarehouse, getReturnReasons, isShipmozoConfigured, ndrAction, type Parcel, type ShipmozoRate } from "@/lib/shipping/shipmozo";
import { fieldErrors, type FormState } from "@/lib/validation/auth";

type Result = { ok: boolean; message: string };
const uuid = z.uuid();
const reason = (e: unknown) => (e instanceof Error ? e.message : "Unknown error");

function done(orderId?: string) {
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/shipments");
  revalidatePath("/admin");
}

export async function getShippingQuote(orderId: string): Promise<{ ok: true; rates: ShipmozoRate[]; parcel: Parcel } | { ok: false; message: string }> {
  await requirePermission("shipments.manage");
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
  if (!isShipmozoConfigured()) return { ok: false, message: "Shipmozo isn't configured." };
  try {
    return { ok: true, ...(await quoteOrder(orderId)) };
  } catch (e) {
    console.error("[shipmozo] quote", orderId, e);
    return { ok: false, message: `Couldn't get rates: ${reason(e)}` };
  }
}

export async function bookShipment(orderId: string, courierId: string): Promise<Result> {
  const user = await requirePermission("shipments.manage");
  if (!uuid.safeParse(orderId).success || !/^(auto|\d{1,10})$/.test(courierId)) return { ok: false, message: "Invalid request." };
  if (!isShipmozoConfigured()) return { ok: false, message: "Shipmozo isn't configured." };
  try {
    const r = await bookOrder(orderId, courierId, `staff:${user.id}`);
    done(orderId);
    return r.ok ? { ok: true, message: `Booked with ${r.courier}, AWB ${r.awb}. The customer has been emailed.` } : r;
  } catch (e) {
    console.error("[shipmozo] book", orderId, e);
    done(orderId);
    return { ok: false, message: `Shipmozo: ${reason(e)}` };
  }
}

export async function refreshTracking(orderId: string): Promise<Result> {
  await requirePermission("shipments.manage");
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
  const { data: s } = await createAdminClient().from("shipments").select("id, provider").eq("order_id", orderId).eq("is_active", true).maybeSingle();
  if (!s || s.provider !== "shipmozo") return { ok: false, message: "No Shipmozo shipment on this order." };
  try {
    const r = await syncTracking(s.id);
    done(orderId);
    return { ok: true, message: r.status ? `Tracking updated: ${r.status.replace(/_/g, " ")}.` : "No courier scans yet." };
  } catch (e) {
    return { ok: false, message: `Couldn't fetch tracking: ${reason(e)}` };
  }
}

export async function syncAllTracking(): Promise<Result> {
  await requirePermission("shipments.manage");
  const [r, ret] = await Promise.all([syncActiveShipments(40), syncReturns(20)]);
  done();
  const failed = r.failed + ret.failed;
  return { ok: failed === 0, message: `Synced ${r.synced} shipment(s) and ${ret.synced} return(s)${failed ? `, ${failed} failed` : ""}.` };
}

export async function cancelShipmentAction(orderId: string, note: string): Promise<Result> {
  const user = await requirePermission("shipments.manage");
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Invalid request." };
  const { data: s } = await createAdminClient().from("shipments").select("id").eq("order_id", orderId).eq("is_active", true).maybeSingle();
  if (!s) return { ok: false, message: "No active shipment." };
  const r = await cancelShipment(s.id, `staff:${user.id}`, note.trim().slice(0, 200) || `Shipment cancelled by ${user.fullName ?? "staff"}`);
  done(orderId);
  return r;
}

const warehouseSchema = z.object({
  title: z.string().trim().min(2, "Name this address").max(60),
  name: z.string().trim().min(2, "Enter a contact name").max(60),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  email: z.email("Enter a valid email"),
  line1: z.string().trim().min(5, "Enter the address").max(120),
  line2: z.string().trim().max(120).optional(),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid pincode"),
});

export async function addPickupWarehouse(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("settings.manage");
  if (!isShipmozoConfigured()) return { message: "Shipmozo isn't configured." };
  const parsed = warehouseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const w = parsed.data;
  try {
    const r = await createWarehouse({
      address_title: w.title,
      name: w.name,
      phone: w.phone,
      alternate_phone: "", // Shipmozo rejects an alternate equal to the main phone
      email: w.email,
      address_line_one: w.line1,
      address_line_two: w.line2 ?? "",
      pin_code: w.pincode,
    });
    await createAdminClient().rpc("audit", { p_actor: user.id, p_action: "shipmozo.warehouse_created", p_entity: "settings", p_entity_id: String(r.warehouse_id), p_details: { title: w.title, pincode: w.pincode } });
    revalidatePath("/admin/settings");
    return { ok: true, message: `Pickup address added (warehouse ${r.warehouse_id}).` };
  } catch (e) {
    return { message: `Shipmozo: ${reason(e)}` };
  }
}

/** Failed delivery: ask the courier to try again, or send the parcel back (RTO). */
export async function resolveNdr(awb: string, action: "REATTEMPT" | "RETURN"): Promise<Result> {
  const user = await requirePermission("shipments.manage");
  if (!/^[A-Za-z0-9-]{4,40}$/.test(awb) || !["REATTEMPT", "RETURN"].includes(action)) return { ok: false, message: "Invalid request." };
  try {
    await ndrAction(awb, action);
  } catch (e) {
    return { ok: false, message: `Shipmozo: ${reason(e)}` };
  }
  const admin = createAdminClient();
  const { data: s } = await admin.from("shipments").select("id, order_id").eq("awb", awb).eq("is_active", true).maybeSingle();
  if (s) {
    await admin.rpc("add_shipment_event", {
      p_shipment_id: s.id,
      p_status: action === "RETURN" ? "rto" : "delayed",
      p_location: "",
      p_description: action === "RETURN" ? "Delivery failed; returning to store" : "Delivery failed; re-attempt requested",
      p_occurred_at: new Date().toISOString(),
      p_actor: `staff:${user.id}`,
    });
  }
  await admin.rpc("audit", { p_actor: user.id, p_action: `ndr.${action.toLowerCase()}`, p_entity: "shipment", p_entity_id: awb });
  done(s?.order_id);
  return { ok: true, message: action === "RETURN" ? "Courier asked to return the parcel." : "Re-attempt requested." };
}

const returnSchema = z.object({
  orderId: z.uuid(),
  reasonId: z.string().regex(/^\d{1,6}$/, "Choose a reason"),
  request: z.enum(["REFUND", "EXCHANGE"]),
  comment: z.string().trim().max(200).optional(),
});

export async function bookReturnAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("shipments.manage");
  if (!isShipmozoConfigured()) return { message: "Shipmozo isn't configured." };
  const parsed = returnSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { orderId, reasonId, request, comment } = parsed.data;
  try {
    const reasons = await getReturnReasons().catch(() => []);
    const r = await bookReturn(orderId, { reasonId, reason: reasons.find((x) => x.id === reasonId)?.name ?? reasonId, request, comment: comment ?? "" }, `staff:${user.id}`);
    done(orderId);
    return r.ok ? { ok: true, message: r.message } : { message: r.message };
  } catch (e) {
    console.error("[shipmozo] return", orderId, e);
    return { message: `Shipmozo: ${reason(e)}` };
  }
}

export async function cancelReturnAction(orderId: string, returnId: string): Promise<Result> {
  await requirePermission("shipments.manage");
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(returnId).success) return { ok: false, message: "Invalid request." };
  const r = await cancelReturn(returnId);
  done(orderId);
  return r;
}
