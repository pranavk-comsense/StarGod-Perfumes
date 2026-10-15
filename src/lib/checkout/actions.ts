"use server";

import { after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/dal";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { sendOrderEmail } from "@/lib/email/order-emails";
import { createOrder, getOrder, isCashfreeConfigured } from "@/lib/payments/cashfree";
import { shippingProvider } from "@/lib/shipping/provider";

const schema = z.object({
  checkoutKey: z.uuid(),
  addressId: z.uuid(),
  paymentMethod: z.enum(["prepaid", "cod"]),
  couponCode: z.string().trim().max(30).optional(),
});

export type PlaceOrderResult =
  | { ok: false; message: string }
  | { ok: true; kind: "cod"; redirectTo: string }
  | { ok: true; kind: "prepaid"; orderNumber: string; paymentSessionId: string; mode: "sandbox" | "production" };

const ERRORS: Record<string, string> = {
  EMPTY_CART: "Your bag is empty.",
  INSUFFICIENT_STOCK: "Some items just went out of stock. Please review your bag.",
  OUT_OF_STOCK: "Some items just went out of stock. Please review your bag.",
  UNAVAILABLE: "Some items are no longer available. Please review your bag.",
  INVALID_QTY: "Please check the quantities in your bag.",
  TOO_MANY_ITEMS: "Your bag has too many different items.",
  COD_UNAVAILABLE: "Cash on Delivery isn't available for this order. Please pay online.",
  INVALID_ADDRESS: "Please check your delivery address.",
};

function friendly(message: string): string {
  if (message.startsWith("COUPON_INVALID:")) return message.slice("COUPON_INVALID:".length);
  const key = Object.keys(ERRORS).find((k) => message.includes(k));
  return key ? ERRORS[key] : "We couldn't place your order. Please try again.";
}

/**
 * Places the order from the user's saved cart. Prices, discounts and fees are
 * computed in Postgres (place_order); stock is reserved atomically. For prepaid
 * orders a Cashfree order is created and its payment session returned to the
 * browser, which opens Cashfree checkout.
 */
export async function placeOrder(input: z.input<typeof schema>): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please choose a delivery address and payment method." };
  const { checkoutKey, addressId, paymentMethod, couponCode } = parsed.data;

  if (!(await rateLimit(`checkout:${user.id}`, 10, 600))) {
    return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  }
  if (paymentMethod === "prepaid" && !isCashfreeConfigured()) {
    return { ok: false, message: "Online payment isn't available yet. Please choose Cash on Delivery." };
  }

  const supabase = await createClient();
  const [{ data: address }, { data: cart }] = await Promise.all([
    supabase.from("addresses").select("name, phone, line1, line2, landmark, city, state, pincode").eq("id", addressId).eq("user_id", user.id).maybeSingle(),
    supabase.from("cart_items").select("variant_id, qty").eq("user_id", user.id),
  ]);
  if (!address) return { ok: false, message: "Please choose a delivery address." };
  if (!cart?.length) return { ok: false, message: "Your bag is empty." };

  // Only a confirmed courier answer blocks the order; estimates (Shipmozo down/unconfigured) let it through.
  const delivery = await shippingProvider().checkServiceability(address.pincode).catch(() => null);
  if (delivery?.confirmed && !delivery.serviceable) return { ok: false, message: `Sorry, we don't deliver to ${address.pincode} yet. Please use a different address.` };
  if (delivery?.confirmed && paymentMethod === "cod" && !delivery.codAvailable) return { ok: false, message: `Cash on Delivery isn't available for ${address.pincode}. Please pay online.` };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("place_order", {
    p_user_id: user.id,
    p_checkout_key: checkoutKey,
    p_items: cart.map((c) => ({ variant_id: c.variant_id, qty: c.qty })),
    p_address: address,
    p_payment_method: paymentMethod,
    p_coupon_code: couponCode || (undefined as unknown as string),
    p_contact_email: user.email ?? (undefined as unknown as string),
  });
  if (error || !data) {
    if (error && !Object.keys(ERRORS).some((k) => error.message.includes(k)) && !error.message.startsWith("COUPON_INVALID")) {
      console.error("[checkout] place_order", error.message);
    }
    return { ok: false, message: friendly(error?.message ?? "") };
  }
  const order = data as { order_id: string; order_number: string; total: number; status: string; existing: boolean };

  if (paymentMethod === "cod") {
    if (!order.existing) after(() => sendOrderEmail(order.order_id, "placed"));
    return { ok: true, kind: "cod", redirectTo: `/account/orders/${order.order_number}?placed=1` };
  }

  // Prepaid: reuse an existing payment session on a retried submit.
  const { data: row } = await admin.from("orders").select("cf_payment_session_id, reserved_until, status").eq("id", order.order_id).single();
  if (row?.status !== "pending_payment") {
    return { ok: true, kind: "cod", redirectTo: `/account/orders/${order.order_number}` };
  }
  if (row.cf_payment_session_id) {
    return { ok: true, kind: "prepaid", orderNumber: order.order_number, paymentSessionId: row.cf_payment_session_id, mode: publicEnv().NEXT_PUBLIC_CASHFREE_MODE };
  }

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  try {
    const cf = await createOrder({
      orderNumber: order.order_number,
      amountPaise: order.total,
      customer: { id: user.id, name: address.name, email: user.email, phone: address.phone },
      returnUrl: `${site}/checkout/return?order=${encodeURIComponent(order.order_number)}`,
      notifyUrl: `${site}/api/webhooks/cashfree`,
      expiresAt: new Date(row.reserved_until ?? Date.now() + 30 * 60 * 1000),
    });
    await admin.from("orders").update({ cf_payment_session_id: cf.payment_session_id }).eq("id", order.order_id);
    return { ok: true, kind: "prepaid", orderNumber: order.order_number, paymentSessionId: cf.payment_session_id, mode: publicEnv().NEXT_PUBLIC_CASHFREE_MODE };
  } catch (e) {
    console.error("[checkout] cashfree createOrder", e);
    // Release the stock hold immediately; the customer can try again.
    await admin.rpc("expire_order_hold", { p_order_id: order.order_id });
    return { ok: false, message: "We couldn't start the payment. Please try again or choose Cash on Delivery." };
  }
}

/** Re-open Cashfree checkout for an unpaid order whose hold hasn't expired. */
export async function retryPayment(orderNumber: string): Promise<PlaceOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, payment_status, reserved_until, cf_payment_session_id")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };
  if (order.status !== "pending_payment" || !order.reserved_until || new Date(order.reserved_until) < new Date()) {
    return { ok: false, message: "This order can no longer be paid. Please place a new order." };
  }
  try {
    const cf = await getOrder(orderNumber);
    if (cf.order_status !== "ACTIVE") return { ok: false, message: "This payment link has expired. Please place a new order." };
    return { ok: true, kind: "prepaid", orderNumber, paymentSessionId: cf.payment_session_id ?? order.cf_payment_session_id!, mode: publicEnv().NEXT_PUBLIC_CASHFREE_MODE };
  } catch (e) {
    console.error("[checkout] retry", e);
    return { ok: false, message: "Couldn't reopen the payment. Please try again." };
  }
}
