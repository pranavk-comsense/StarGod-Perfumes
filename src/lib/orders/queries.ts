import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const ORDER_DETAIL_SELECT = `
  id, order_number, user_id, status, payment_method, payment_status, shipping_address, contact_email,
  subtotal, offer_discount, discount, shipping_fee, cod_fee, total, gst_amount, coupon_code, needs_refund, admin_note,
  reserved_until, paid_at, cancelled_at, created_at,
  order_items ( id, product_id, product_name, product_slug, variant_label, sku, image_path, unit_price, mrp, qty, gst_rate, line_total ),
  order_status_history ( id, from_status, to_status, note, actor, created_at ),
  shipments ( id, provider, awb, courier_name, status, tracking_url, is_active, created_at, shipment_events ( id, status, location, description, occurred_at ) ),
  refunds ( id, refund_id, amount, status, reason, created_at, processed_at )
`;

export async function getOrderDetail(supabase: SupabaseClient<Database>, by: { orderNumber: string } | { id: string }) {
  const q = supabase.from("orders").select(ORDER_DETAIL_SELECT);
  const { data, error } = await ("orderNumber" in by ? q.eq("order_number", by.orderNumber) : q.eq("id", by.id)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...data,
    order_status_history: [...data.order_status_history].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    shipments: data.shipments.map((s) => ({
      ...s,
      shipment_events: [...s.shipment_events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)),
    })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

export type ShippingAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

/** Customers can cancel until the parcel ships. */
export function customerCanCancel(o: Pick<OrderDetail, "status" | "shipments">) {
  return (o.status === "confirmed" || o.status === "pending_payment") && !o.shipments.some((s) => s.is_active);
}
