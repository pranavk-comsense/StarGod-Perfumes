import "server-only";
import { serverEnv } from "@/lib/env";

/**
 * Shipmozo REST client: server-side only.
 * Docs: https://shipping-api.com/api/documentation (OpenAPI: /api/v1?api-docs-v1.json)
 * Every response is { result: "1" | "0", message, data }; amounts are rupees,
 * weights grams, dimensions cm. Our Shipmozo order_id is the store order_number.
 */
const BASE_URL = "https://shipping-api.com/app/api/v1";

export class ShipmozoError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}

export function isShipmozoConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.SHIPMOZO_PUBLIC_KEY && env.SHIPMOZO_PRIVATE_KEY);
}

type Envelope<T> = { result: string | number; message?: string; data: T };

async function request<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const env = serverEnv();
  if (!env.SHIPMOZO_PUBLIC_KEY || !env.SHIPMOZO_PRIVATE_KEY) throw new ShipmozoError("Shipmozo is not configured", 503);
  const qs = init.query ? `?${new URLSearchParams(init.query)}` : "";
  const res = await fetch(`${BASE_URL}${path}${qs}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "public-key": env.SHIPMOZO_PUBLIC_KEY,
      "private-key": env.SHIPMOZO_PRIVATE_KEY,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let json: Envelope<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ShipmozoError(`Shipmozo ${res.status}: unexpected response`, res.status);
  }
  if (!res.ok || String(json.result) !== "1") {
    throw new ShipmozoError(errorMessage(json) || `Shipmozo ${res.status}`, res.status, json?.data);
  }
  return json.data;
}

/** Validation errors arrive either as `message` or as a { field: [msg] } map in `data`. */
function errorMessage(json: Envelope<unknown> | undefined): string {
  const data = json?.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const first = Object.values(data).flat().find((v) => typeof v === "string");
    if (first && (!json?.message || /valid|required|error/i.test(json.message))) return String(first);
  }
  return json?.message ?? "";
}

// -----------------------------------------------------------------------------
// Rates
// -----------------------------------------------------------------------------
export type ShipmozoRate = {
  courierId: string;
  name: string;
  etaDays: number | null;
  /** paise, including GST and COD charges */
  total: number;
  codCharges: number;
  minChargeableWeight: string | null;
};

type RawRate = {
  id: number | string;
  name: string;
  estimated_delivery?: string;
  total_charges: number | string;
  overhead_charges_details?: { name: string; value: number }[];
  minimum_chargeable_weight?: string;
};

export type Parcel = { weightG: number; lengthCm: number; widthCm: number; heightCm: number };

export async function getRates(input: {
  pickupPincode: string;
  deliveryPincode: string;
  paymentType: "PREPAID" | "COD";
  orderAmount: number; // paise
  parcel: Parcel;
  orderNumber?: string;
}): Promise<ShipmozoRate[]> {
  const rupees = String(Math.round(input.orderAmount / 100));
  const data = await request<RawRate[]>("/rate-calculator", {
    method: "POST",
    body: {
      order_id: input.orderNumber ?? "",
      pickup_pincode: input.pickupPincode,
      delivery_pincode: input.deliveryPincode,
      payment_type: input.paymentType,
      shipment_type: "FORWARD",
      order_amount: rupees,
      type_of_package: "SPS",
      rov_type: "ROV_OWNER",
      cod_amount: input.paymentType === "COD" ? rupees : "",
      weight: String(Math.round(input.parcel.weightG)),
      dimensions: [{ no_of_box: "1", length: String(input.parcel.lengthCm), width: String(input.parcel.widthCm), height: String(input.parcel.heightCm) }],
    },
  });
  return (Array.isArray(data) ? data : [])
    .map((r) => ({
      courierId: String(r.id),
      name: r.name,
      etaDays: parseInt(r.estimated_delivery ?? "", 10) || null,
      total: Math.round(Number(r.total_charges) * 100),
      codCharges: Math.round((r.overhead_charges_details?.find((c) => /cod/i.test(c.name))?.value ?? 0) * 100),
      minChargeableWeight: r.minimum_chargeable_weight ?? null,
    }))
    .sort((a, b) => a.total - b.total);
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------
export type PushOrderInput = {
  order_id: string;
  order_date: string; // YYYY-MM-DD
  consignee_name: string;
  consignee_phone: string;
  consignee_email: string;
  consignee_address_line_one: string;
  consignee_address_line_two: string;
  consignee_pin_code: string;
  consignee_city: string;
  consignee_state: string;
  product_detail: { name: string; sku_number: string; quantity: number; discount: string; hsn: string; unit_price: number; product_category: string }[];
  payment_type: "PREPAID" | "COD";
  cod_amount: string;
  shipping_charges: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  warehouse_id: string;
  gst_ewaybill_number: string;
  gstin_number: string;
};

export async function pushOrder(input: PushOrderInput) {
  return request<{ order_id: string; refrence_id?: string }>("/push-order", { method: "POST", body: input });
}

export async function assignCourier(orderNumber: string, courierId: string) {
  return request<{ order_id: string; courier?: string }>("/assign-courier", { method: "POST", body: { order_id: orderNumber, courier_id: courierId } });
}

export async function autoAssign(orderNumber: string) {
  return request<{ order_id: string; awb_number?: string; courier_company?: string; courier_company_service?: string }>("/auto-assign-order", {
    method: "POST",
    body: { order_id: orderNumber },
  });
}

export async function schedulePickup(orderNumber: string) {
  return request<{ order_id: string; courier?: string; awb_number?: string; lr_number?: string }>("/schedule-pickup", { method: "POST", body: { order_id: orderNumber } });
}

export async function getOrderDetail(orderNumber: string) {
  return request<unknown>(`/get-order-detail/${encodeURIComponent(orderNumber)}`);
}

export async function cancelOrder(orderNumber: string, awb: string) {
  return request<unknown>("/cancel-order", { method: "POST", body: { order_id: orderNumber, awb_number: awb } });
}

export type ShipmozoDocument = { url: string } | { pdf: Buffer };

/** Labels and manifests come back as either a link or base64 PDF data, depending on the courier. */
function documentFrom(data: unknown, what: string): ShipmozoDocument {
  const value = findString(data, (s) => /^https?:\/\//.test(s) || s.length > 200);
  if (!value) throw new ShipmozoError(`${what} not available yet`, 404, data);
  if (/^https?:\/\//.test(value)) return { url: value };
  return { pdf: Buffer.from(value.replace(/^data:application\/pdf;base64,/, ""), "base64") };
}

export async function getLabel(awb: string): Promise<ShipmozoDocument> {
  return documentFrom(await request<unknown>(`/get-order-label/${encodeURIComponent(awb)}`, { query: { type_of_label: "PDF" } }), "Label");
}

/** Pickup manifest (handover sheet) for up to 25 AWBs. */
export async function generateManifest(awbs: string[]): Promise<ShipmozoDocument> {
  return documentFrom(await request<unknown>("/generate-manifest", { query: { awb_numbers: awbs.slice(0, 25).join(",") } }), "Manifest");
}

// -----------------------------------------------------------------------------
// NDR (failed delivery attempts)
// -----------------------------------------------------------------------------
export type Ndr = { awb: string; orderId: string; reason: string; attempts: string; date: string; raw: Record<string, unknown> };

export async function getNdrs(): Promise<Ndr[]> {
  const data = await request<Record<string, unknown>[]>("/get-ndr-all", { query: { per_page: "100" } });
  return (Array.isArray(data) ? data : [])
    .map((n) => ({
      awb: pick(n, ["awb_number", "awb", "awb_no"]) || findString(n, (s) => s.length >= 6, /awb/i) || "",
      orderId: pick(n, ["order_id", "reference_id", "refrence_id"]),
      reason: pick(n, ["ndr_reason", "reason", "ndr_remark", "remark", "remarks", "status"]),
      attempts: pick(n, ["attempts", "attempt", "ndr_attempt", "attempt_count", "no_of_attempt"]),
      date: pick(n, ["ndr_date", "date", "updated_at", "created_at"]),
      raw: n,
    }))
    .filter((n) => n.awb);
}

export async function ndrAction(awb: string, action: "REATTEMPT" | "RETURN") {
  return request<unknown>(`/ndr-action/${encodeURIComponent(awb)}`, { method: "POST", query: { action } });
}

// -----------------------------------------------------------------------------
// Returns (reverse pickup from the customer to our warehouse)
// -----------------------------------------------------------------------------
export async function getReturnReasons(): Promise<{ id: string; name: string }[]> {
  const data = await request<{ id: number | string; name: string }[]>("/get-return-reason");
  return (Array.isArray(data) ? data : []).map((r) => ({ id: String(r.id), name: r.name }));
}

export type PushReturnInput = {
  order_id: string;
  order_date: string;
  pickup_name: string;
  pickup_phone: string;
  pickup_email: string;
  pickup_address_line_one: string;
  pickup_address_line_two: string;
  pickup_pin_code: string;
  pickup_city: string;
  pickup_state: string;
  product_detail: PushOrderInput["product_detail"];
  payment_type: "PREPAID";
  weight: string;
  length: string;
  width: string;
  height: string;
  warehouse_id: string;
  return_reason_id: string;
  customer_request: "REFUND" | "EXCHANGE";
  reason_comment: string;
};

export async function pushReturnOrder(input: PushReturnInput) {
  return request<{ order_id: string; refrence_id?: string }>("/push-return-order", { method: "POST", body: input });
}

// -----------------------------------------------------------------------------
// Tracking
// -----------------------------------------------------------------------------
export type TrackingScan = { status: string; location: string; description: string; occurredAt: string };
export type Tracking = { currentStatus: string | null; scans: TrackingScan[]; raw: unknown };

export async function trackOrder(awb: string): Promise<Tracking> {
  const data = await request<unknown>("/track-order", { query: { awb_number: awb } });
  const root = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  const list = root && (Object.values(root).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === "object") as Record<string, unknown>[] | undefined);
  const scans = (list ?? [])
    .map((s) => {
      const status = pick(s, ["status", "scan_status", "current_status", "activity", "remark", "remarks"]);
      const when = pick(s, ["date", "scan_date", "status_time", "date_time", "datetime", "time", "updated_at"]);
      return {
        status,
        location: pick(s, ["location", "scan_location", "city"]),
        description: pick(s, ["remark", "remarks", "description", "activity", "status"]) || status,
        occurredAt: toIso(when),
      };
    })
    .filter((s) => s.status && s.occurredAt);
  return { currentStatus: root ? pick(root, ["current_status", "status", "shipment_status"]) || null : null, scans, raw: data };
}

/** Courier status text → our shipment status. null = informational, ignore. */
export function mapTrackingStatus(text: string): "in_transit" | "out_for_delivery" | "delivered" | "rto" | "delayed" | null {
  const t = text.toLowerCase();
  if (/rto|return(ed)? to origin|returning/.test(t)) return "rto";
  if (/out for delivery|ofd/.test(t)) return "out_for_delivery";
  if (/undeliver|not delivered|failed|attempt/.test(t)) return "delayed";
  if (/delivered/.test(t)) return "delivered";
  if (/transit|picked|dispatch|shipped|manifest|reached|arrived|connected|bagged/.test(t)) return "in_transit";
  if (/delay|hold|ndr/.test(t)) return "delayed";
  return null;
}

// -----------------------------------------------------------------------------
// Warehouses (pickup addresses)
// -----------------------------------------------------------------------------
export type Warehouse = { id: string; title: string; pincode: string; address: string; isDefault: boolean };

export async function getWarehouses(): Promise<Warehouse[]> {
  const data = await request<Record<string, unknown>[]>("/get-warehouses");
  return (Array.isArray(data) ? data : []).map((w) => ({
    id: pick(w, ["id", "warehouse_id"]),
    title: pick(w, ["address_title", "title", "name"]),
    pincode: pick(w, ["pin_code", "pincode"]),
    address: [pick(w, ["address_line_one"]), pick(w, ["address_line_two"])].filter(Boolean).join(", "),
    isDefault: ["1", "true", "yes"].includes(pick(w, ["default", "is_default", "is_primary"]).toLowerCase()),
  }));
}

export async function createWarehouse(input: {
  address_title: string;
  name: string;
  phone: string;
  alternate_phone: string;
  email: string;
  address_line_one: string;
  address_line_two: string;
  pin_code: string;
}) {
  return request<{ warehouse_id: string | number }>("/create-warehouse", { method: "POST", body: input });
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "" && typeof v !== "object") return String(v).trim();
  }
  return "";
}

/** Depth-first search for the first string matching `test` (labels, AWBs in nested payloads). */
export function findString(value: unknown, test: (s: string) => boolean, keyHint?: RegExp, key = ""): string | null {
  if (typeof value === "string") return test(value) && (!keyHint || keyHint.test(key)) ? value : null;
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const hit = findString(v, test, keyHint, k);
      if (hit) return hit;
    }
  }
  return null;
}

/** Accepts ISO, "YYYY-MM-DD HH:mm:ss" and "DD-MM-YYYY HH:mm" (IST, as Indian couriers report). */
function toIso(when: string): string {
  if (!when) return "";
  const dmy = when.match(/^(\d{2})[-/](\d{2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  const s = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}T${(dmy[4] ?? "00").padStart(2, "0")}:${dmy[5] ?? "00"}:${dmy[6] ?? "00"}` : when.replace(" ", "T");
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}+05:30`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}
