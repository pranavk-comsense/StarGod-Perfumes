export type CartItem = { variantId: string; qty: number };

export const MAX_QTY = 10;
export const MAX_LINES = 20;

export type QuoteLine = {
  variant_id: string;
  product_id: string | null;
  product_name: string | null;
  product_slug: string | null;
  sku: string | null;
  label: string | null;
  size_ml: number | null;
  image_path: string | null;
  qty: number;
  unit_price: number | null;
  mrp: number | null;
  line_total: number | null;
  stock: number | null;
  issue: "unavailable" | "invalid_qty" | "insufficient_stock" | null;
};

/** Mirrors the jsonb returned by public.quote_cart(). All amounts in paise. */
export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  mrp_total: number;
  /** Buy-1-Get-1 savings (paise), applied before coupons. */
  offer_discount: number;
  offers: { collection: string; name: string; free_units: number; amount: number; add_one_more: boolean }[];
  discount: number;
  shipping_fee: number;
  cod_fee: number;
  total: number;
  gst_amount: number;
  coupon: { id: string; code: string; type: string; description: string | null } | null;
  coupon_error: string | null;
  free_shipping_threshold: number | null;
  cod_available: boolean;
  cod_unavailable_reason: string | null;
  errors: { code: string; variant_id?: string; available?: number; message?: string }[];
};
