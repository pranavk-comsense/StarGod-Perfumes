import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderEmail } from "@/lib/email/order-emails";
import type { ShippingAddress } from "@/lib/orders/queries";
import * as sm from "@/lib/shipping/shipmozo";

/**
 * Shipmozo order lifecycle: quote → push + assign courier + schedule pickup
 * (gives the AWB) → tracking sync → cancel. The Shipmozo order_id is our
 * order_number (with -R1, -R2… after a cancelled booking), so a retried
 * booking picks up where a failed one stopped.
 */

const db = () => createAdminClient();

async function loadOrder(orderId: string) {
  const { data, error } = await db()
    .from("orders")
    .select(
      "id, order_number, status, payment_method, total, shipping_fee, shipping_address, contact_email, created_at, user_id, order_items ( product_name, sku, qty, unit_price, product_variants ( weight_g, length_cm, breadth_cm, height_cm ), products ( hsn_code ) )",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

/** One box: bottles side by side, so the largest footprint and stacked heights. */
function parcelFor(order: LoadedOrder): sm.Parcel {
  let weightG = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let heightCm = 0;
  for (const i of order.order_items) {
    const v = i.product_variants ?? { weight_g: 300, length_cm: 10, breadth_cm: 10, height_cm: 15 };
    weightG += v.weight_g * i.qty;
    lengthCm = Math.max(lengthCm, Number(v.length_cm));
    widthCm = Math.max(widthCm, Number(v.breadth_cm));
    heightCm += Number(v.height_cm) * i.qty;
  }
  return { weightG: Math.max(weightG, 100), lengthCm: lengthCm || 10, widthCm: widthCm || 10, heightCm: Math.min(heightCm || 15, 100) };
}

let warehouseCache: { id: string; pincode: string } | undefined;
export async function resolveWarehouse(): Promise<{ id: string; pincode: string }> {
  const env = serverEnv();
  if (warehouseCache) return warehouseCache;
  const all = await sm.getWarehouses();
  const w = env.SHIPMOZO_WAREHOUSE_ID ? all.find((x) => x.id === env.SHIPMOZO_WAREHOUSE_ID) : (all.find((x) => x.isDefault) ?? all[0]);
  if (!w) throw new sm.ShipmozoError(env.SHIPMOZO_WAREHOUSE_ID ? "The configured Shipmozo warehouse wasn't found." : "Add a pickup warehouse in Shipmozo (or from Admin → Settings) first.", 400);
  return (warehouseCache = { id: w.id, pincode: w.pincode || env.SHIPMOZO_PICKUP_PINCODE });
}

export async function quoteOrder(orderId: string): Promise<{ rates: sm.ShipmozoRate[]; parcel: sm.Parcel }> {
  const order = await loadOrder(orderId);
  if (!order) throw new Error("Order not found");
  const address = order.shipping_address as unknown as ShippingAddress;
  const { pincode } = await resolveWarehouse();
  const parcel = parcelFor(order);
  const rates = await sm.getRates({
    pickupPincode: pincode,
    deliveryPincode: address.pincode,
    paymentType: order.payment_method === "cod" ? "COD" : "PREPAID",
    orderAmount: order.total,
    parcel,
  });
  return { rates, parcel };
}

export type BookResult = { ok: true; awb: string; courier: string } | { ok: false; message: string };

export async function bookOrder(orderId: string, courierId: string, actor: string): Promise<BookResult> {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (order.status !== "confirmed" && order.status !== "processing") return { ok: false, message: "Only confirmed or packed orders can be shipped." };

  const address = order.shipping_address as unknown as ShippingAddress;
  const warehouse = await resolveWarehouse();
  const parcel = parcelFor(order);
  const isCod = order.payment_method === "cod";
  const rupees = (p: number) => String(Math.round(p) / 100);

  // Rate check: confirms the courier serves this route and gives the cost we record.
  const rates = await sm.getRates({ pickupPincode: warehouse.pincode, deliveryPincode: address.pincode, paymentType: isCod ? "COD" : "PREPAID", orderAmount: order.total, parcel });
  const rate = courierId === "auto" ? rates[0] : rates.find((r) => r.courierId === courierId);
  if (!rate) return { ok: false, message: rates.length ? "That courier no longer serves this pincode. Refresh the rates." : "No courier serves this pincode." };

  const { count: cancelled } = await db().from("shipments").select("id", { count: "exact", head: true }).eq("order_id", orderId).eq("provider", "shipmozo").eq("is_active", false);
  const smOrderId = cancelled ? `${order.order_number}-R${cancelled}` : order.order_number;

  const existing = await sm.getOrderDetail(smOrderId).catch(() => null);
  let awb = existing ? sm.findString(existing, (s) => s.length >= 6, /awb/i) : null;
  let courierName = rate.name;

  if (!existing) {
    const { data: profile } = await db().from("profiles").select("email").eq("id", order.user_id).maybeSingle();
    await sm.pushOrder({
      order_id: smOrderId,
      order_date: order.created_at.slice(0, 10),
      consignee_name: address.name,
      consignee_phone: address.phone.replace(/\D/g, "").slice(-10),
      consignee_email: order.contact_email ?? profile?.email ?? "",
      consignee_address_line_one: address.line1,
      consignee_address_line_two: [address.line2, address.landmark].filter(Boolean).join(", "),
      consignee_pin_code: address.pincode,
      consignee_city: address.city,
      consignee_state: address.state,
      product_detail: order.order_items.map((i) => ({
        name: i.product_name,
        sku_number: i.sku,
        quantity: i.qty,
        discount: "",
        hsn: i.products?.hsn_code ?? "33030090",
        unit_price: Math.round(i.unit_price) / 100,
        product_category: "Other",
      })),
      payment_type: isCod ? "COD" : "PREPAID",
      cod_amount: isCod ? rupees(order.total) : "",
      shipping_charges: rupees(order.shipping_fee),
      weight: String(parcel.weightG),
      length: String(parcel.lengthCm),
      width: String(parcel.widthCm),
      height: String(parcel.heightCm),
      warehouse_id: warehouse.id,
      gst_ewaybill_number: "",
      gstin_number: "",
    });
  }

  if (!awb) {
    if (courierId === "auto") {
      const r = await sm.autoAssign(smOrderId);
      awb = r.awb_number ?? null;
      courierName = r.courier_company_service || r.courier_company || courierName;
    } else {
      const r = await sm.assignCourier(smOrderId, rate.courierId);
      courierName = r.courier || courierName;
    }
  }
  if (!awb) {
    // Some couriers schedule the pickup themselves; then the AWB is only on the order.
    const pickup = await sm.schedulePickup(smOrderId).catch((e) => {
      console.warn("[shipmozo] schedule-pickup", smOrderId, e);
      return null;
    });
    awb = pickup?.awb_number || null;
    if (!awb) awb = sm.findString(await sm.getOrderDetail(smOrderId), (s) => s.length >= 6, /awb/i);
  }
  if (!awb) return { ok: false, message: "Courier assigned, but Shipmozo hasn't issued an AWB yet. Try again in a minute." };

  const { data: shipmentId, error } = await db().rpc("create_shipment", {
    p_order_id: orderId,
    p_provider: "shipmozo",
    p_courier_name: courierName,
    p_awb: awb,
    p_tracking_url: "",
    p_actor: actor,
    p_raw: { rate, existing } as never,
  });
  if (error) return { ok: false, message: error.message.includes("shipments_awb_key") ? `AWB ${awb} is already recorded on another shipment.` : "Booked on Shipmozo, but saving the shipment failed." };
  await db()
    .from("shipments")
    .update({ provider_ref: smOrderId, courier_id: rate.courierId, charges: rate.total, weight_g: parcel.weightG, dims: parcel, last_synced_at: null })
    .eq("id", shipmentId);

  await sendOrderEmail(orderId, "shipped", { courier: courierName, awb, trackingUrl: null }).catch((e) => console.error("[shipmozo] email", e));
  return { ok: true, awb, courier: courierName };
}

/** Pulls courier scans into shipment_events; terminal scans move the order along. */
export async function syncTracking(shipmentId: string): Promise<{ added: number; status: string | null }> {
  const { data: s } = await db().from("shipments").select("id, order_id, awb, status, orders ( status )").eq("id", shipmentId).maybeSingle();
  if (!s?.awb) return { added: 0, status: null };
  const before = (s.orders as { status: string } | null)?.status;

  const tracking = await sm.trackOrder(s.awb);
  const scans = [...tracking.scans].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  let added = 0;
  let latest: string | null = null;
  for (const scan of scans) {
    const status = sm.mapTrackingStatus(scan.status) ?? sm.mapTrackingStatus(scan.description);
    if (!status) continue;
    latest = status;
    const { error } = await db().rpc("add_shipment_event", {
      p_shipment_id: s.id,
      p_status: status,
      p_location: scan.location,
      p_description: scan.description,
      p_occurred_at: scan.occurredAt,
      p_actor: "shipmozo",
    });
    if (!error) added++;
  }
  // No usable scans but a current status (e.g. "Delivered" with an empty history).
  if (!latest && tracking.currentStatus) {
    const status = sm.mapTrackingStatus(tracking.currentStatus);
    if (status && status !== s.status) {
      await db().rpc("add_shipment_event", { p_shipment_id: s.id, p_status: status, p_location: "", p_description: tracking.currentStatus, p_occurred_at: new Date().toISOString(), p_actor: "shipmozo" });
      latest = status;
      added++;
    }
  }
  await db().from("shipments").update({ last_synced_at: new Date().toISOString() }).eq("id", s.id);

  if (before === "shipped" && latest === "delivered") await sendOrderEmail(s.order_id, "delivered").catch((e) => console.error("[shipmozo] email", e));
  return { added, status: latest };
}

/** Syncs the least recently synced in-flight Shipmozo shipments (cron + admin "Sync all"). */
export async function syncActiveShipments(limit: number): Promise<{ synced: number; failed: number }> {
  const { data } = await db()
    .from("shipments")
    .select("id")
    .eq("is_active", true)
    .eq("provider", "shipmozo")
    .not("status", "in", "(delivered,rto,cancelled)")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const result = { synced: 0, failed: 0 };
  for (const s of data ?? []) {
    try {
      await syncTracking(s.id);
      result.synced++;
    } catch (e) {
      result.failed++;
      console.error("[shipmozo] sync", s.id, e);
    }
  }
  return result;
}

/** Cancels the courier booking (Shipmozo shipments) and returns the order to "packed". */
export async function cancelShipment(shipmentId: string, actor: string, reason: string): Promise<{ ok: boolean; message: string }> {
  const { data: s } = await db().from("shipments").select("id, provider, provider_ref, awb, orders ( order_number )").eq("id", shipmentId).eq("is_active", true).maybeSingle();
  if (!s) return { ok: false, message: "Shipment not found." };
  if (s.provider === "shipmozo" && s.awb) {
    const orderNumber = s.provider_ref ?? (s.orders as { order_number: string } | null)?.order_number ?? "";
    try {
      await sm.cancelOrder(orderNumber, s.awb);
    } catch (e) {
      return { ok: false, message: `Shipmozo couldn't cancel it: ${e instanceof Error ? e.message : "unknown error"}` };
    }
  }
  const { error } = await db().rpc("cancel_shipment", { p_shipment_id: s.id, p_actor: actor, p_reason: reason });
  if (error) return { ok: false, message: error.message.includes("NOT_CANCELLABLE") ? "Only shipments that haven't been delivered can be cancelled." : "Couldn't update the shipment." };
  return { ok: true, message: s.provider === "shipmozo" ? "Shipment cancelled with Shipmozo. The order is back to packed." : "Shipment removed. The order is back to packed." };
}

// -----------------------------------------------------------------------------
// Returns: reverse pickup from the customer's address to our warehouse
// -----------------------------------------------------------------------------
export async function bookReturn(
  orderId: string,
  input: { reasonId: string; reason: string; request: "REFUND" | "EXCHANGE"; comment: string },
  actor: string,
): Promise<{ ok: boolean; message: string }> {
  const order = await loadOrder(orderId);
  if (!order) return { ok: false, message: "Order not found." };
  if (order.status !== "delivered") return { ok: false, message: "Returns can only be arranged for delivered orders." };

  const { data: returns } = await db().from("return_shipments").select("id, provider_ref, awb, is_active").eq("order_id", orderId);
  let row = returns?.find((r) => r.is_active);
  if (row?.awb) return { ok: false, message: `A return pickup is already booked (AWB ${row.awb}).` };

  if (!row) {
    const address = order.shipping_address as unknown as ShippingAddress;
    const warehouse = await resolveWarehouse();
    const parcel = parcelFor(order);
    const providerRef = `${order.order_number}-RET${returns?.length ? returns.length + 1 : ""}`;
    const { data: profile } = await db().from("profiles").select("email").eq("id", order.user_id).maybeSingle();
    await sm.pushReturnOrder({
      order_id: providerRef,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_name: address.name,
      pickup_phone: address.phone.replace(/\D/g, "").slice(-10),
      pickup_email: order.contact_email ?? profile?.email ?? "",
      pickup_address_line_one: address.line1,
      pickup_address_line_two: [address.line2, address.landmark].filter(Boolean).join(", "),
      pickup_pin_code: address.pincode,
      pickup_city: address.city,
      pickup_state: address.state,
      product_detail: order.order_items.map((i) => ({
        name: i.product_name,
        sku_number: i.sku,
        quantity: i.qty,
        discount: "",
        hsn: i.products?.hsn_code ?? "33030090",
        unit_price: Math.round(i.unit_price) / 100,
        product_category: "Other",
      })),
      payment_type: "PREPAID",
      weight: String(parcel.weightG),
      length: String(parcel.lengthCm),
      width: String(parcel.widthCm),
      height: String(parcel.heightCm),
      warehouse_id: warehouse.id,
      return_reason_id: input.reasonId,
      customer_request: input.request,
      reason_comment: input.comment,
    });
    const { data, error } = await db()
      .from("return_shipments")
      .insert({ order_id: orderId, provider_ref: providerRef, reason: input.reason, customer_request: input.request, comment: input.comment || null, created_by: actor })
      .select("id, provider_ref, awb, is_active")
      .single();
    if (error) return { ok: false, message: "Return created on Shipmozo, but saving it failed. Check the Shipmozo panel." };
    row = data;
  }

  try {
    const r = await sm.autoAssign(row.provider_ref);
    const awb = r.awb_number || sm.findString(await sm.getOrderDetail(row.provider_ref).catch(() => null), (s) => s.length >= 6, /awb/i);
    const courier = r.courier_company_service || r.courier_company || null;
    await db()
      .from("return_shipments")
      .update({ awb, courier_name: courier, status: awb ? "pickup_scheduled" : "courier_assigned", raw: r as never })
      .eq("id", row.id);
    await db().rpc("audit", { p_actor: actor.replace(/^staff:/, ""), p_action: "return.booked", p_entity: "order", p_entity_id: orderId, p_details: { provider_ref: row.provider_ref, awb } });
    return awb ? { ok: true, message: `Return pickup booked with ${courier ?? "the courier"}, AWB ${awb}.` } : { ok: true, message: "Return created and courier assigned; the AWB will appear after the next sync." };
  } catch (e) {
    await db().from("return_shipments").update({ status: "needs_courier" }).eq("id", row.id);
    return { ok: false, message: `Return created on Shipmozo, but no courier could be assigned: ${e instanceof Error ? e.message : "unknown error"}. Try again, or assign one in the Shipmozo panel.` };
  }
}

/** Updates open return pickups from courier tracking. "delivered" = parcel back at the store. */
export async function syncReturns(limit: number): Promise<{ synced: number; failed: number }> {
  const { data } = await db()
    .from("return_shipments")
    .select("id, provider_ref, awb, status")
    .eq("is_active", true)
    .not("status", "in", "(delivered,cancelled)")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  const result = { synced: 0, failed: 0 };
  for (const r of data ?? []) {
    try {
      let awb = r.awb;
      if (!awb) awb = sm.findString(await sm.getOrderDetail(r.provider_ref), (s) => s.length >= 6, /awb/i);
      let status = r.status;
      if (awb) {
        const t = await sm.trackOrder(awb).catch(() => null);
        const texts = [...(t?.scans ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((s) => s.status);
        if (t?.currentStatus) texts.unshift(t.currentStatus);
        status = texts.map(sm.mapTrackingStatus).find(Boolean) ?? (r.awb ? r.status : "pickup_scheduled");
      }
      await db().from("return_shipments").update({ awb, status, last_synced_at: new Date().toISOString() }).eq("id", r.id);
      result.synced++;
    } catch (e) {
      result.failed++;
      console.error("[shipmozo] return sync", r.id, e);
    }
  }
  return result;
}

export async function cancelReturn(returnId: string): Promise<{ ok: boolean; message: string }> {
  const { data: r } = await db().from("return_shipments").select("id, provider_ref, awb").eq("id", returnId).eq("is_active", true).maybeSingle();
  if (!r) return { ok: false, message: "Return not found." };
  if (r.awb) {
    try {
      await sm.cancelOrder(r.provider_ref, r.awb);
    } catch (e) {
      return { ok: false, message: `Shipmozo couldn't cancel it: ${e instanceof Error ? e.message : "unknown error"}` };
    }
  }
  await db().from("return_shipments").update({ is_active: false, status: "cancelled" }).eq("id", r.id);
  return { ok: true, message: "Return pickup cancelled." };
}
