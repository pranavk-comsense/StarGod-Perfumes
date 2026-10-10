"use server";

import { z } from "zod";
import { createClient, getUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { MAX_LINES, MAX_QTY, type CartItem, type Quote } from "@/lib/cart/types";

const itemsSchema = z
  .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY) }))
  .max(MAX_LINES);

function normalise(items: CartItem[]): CartItem[] {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, Math.min(MAX_QTY, (merged.get(i.variantId) ?? 0) + i.qty));
  return [...merged].map(([variantId, qty]) => ({ variantId, qty }));
}

async function dbCart(userId: string): Promise<CartItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("cart_items").select("variant_id, qty").eq("user_id", userId).order("updated_at");
  return (data ?? []).map((r) => ({ variantId: r.variant_id, qty: r.qty }));
}

/**
 * Called by the cart provider on load and whenever the signed-in user changes.
 * Signed in: merges any guest (localStorage) items into the saved cart and
 * returns it. Guest: returns null so the client keeps using localStorage.
 */
export async function loadCart(guestItems: CartItem[]): Promise<{ signedIn: boolean; items: CartItem[] }> {
  const userId = await getUserId();
  if (!userId) return { signedIn: false, items: [] };

  const parsed = itemsSchema.safeParse(guestItems);
  if (parsed.success && parsed.data.length > 0) {
    const current = await dbCart(userId);
    const merged = normalise([...current, ...parsed.data]).slice(0, MAX_LINES);
    const supabase = await createClient();
    const { error } = await supabase
      .from("cart_items")
      .upsert(merged.map((i) => ({ user_id: userId, variant_id: i.variantId, qty: i.qty })), { onConflict: "user_id,variant_id" });
    if (error) console.error("[cart] merge", error.message);
  }
  return { signedIn: true, items: await dbCart(userId) };
}

/** Signed-in only: set a line's quantity (0 removes it). */
export async function setCartItem(variantId: string, qty: number): Promise<{ ok: boolean }> {
  const userId = await getUserId();
  if (!userId || !z.uuid().safeParse(variantId).success || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) {
    return { ok: false };
  }
  const supabase = await createClient();
  const { error } =
    qty === 0
      ? await supabase.from("cart_items").delete().eq("user_id", userId).eq("variant_id", variantId)
      : await supabase.from("cart_items").upsert({ user_id: userId, variant_id: variantId, qty }, { onConflict: "user_id,variant_id" });
  if (error) console.error("[cart] set", error.message);
  return { ok: !error };
}

/**
 * Server-priced quote for the given items. Prices, discounts, shipping and COD
 * fees all come from Postgres (quote_cart); the client never sends amounts.
 */
export async function getQuote(items: CartItem[], couponCode?: string, paymentMethod: "prepaid" | "cod" = "prepaid"): Promise<Quote | null> {
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return null;
  if (parsed.data.length === 0) return null;

  const userId = await getUserId();
  const code = couponCode?.trim().slice(0, 30) || undefined;
  if (code && !(await rateLimit(`coupon:${userId ?? await clientIp()}`, 30, 600))) {
    return null;
  }

  const { data, error } = await createAdminClient().rpc("quote_cart", {
    p_user_id: userId as string,
    p_items: parsed.data.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    p_coupon_code: code as string,
    p_payment_method: paymentMethod,
  });
  if (error) {
    console.error("[cart] quote", error.message);
    return null;
  }
  return data as unknown as Quote;
}
