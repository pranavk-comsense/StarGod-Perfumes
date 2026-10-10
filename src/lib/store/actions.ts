"use server";

import { z } from "zod";
import { updateTag } from "next/cache";
import { createClient, getUserId } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { shippingProvider, type Serviceability } from "@/lib/shipping/provider";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { fieldErrors, type FormState } from "@/lib/validation/auth";

// -----------------------------------------------------------------------------
// Pincode serviceability
// -----------------------------------------------------------------------------
export async function checkPincode(pincode: string): Promise<{ ok: true; result: Serviceability } | { ok: false; message: string }> {
  const pin = String(pincode ?? "").trim();
  if (!/^[1-9][0-9]{5}$/.test(pin)) return { ok: false, message: "Enter a valid 6-digit pincode." };
  if (!(await rateLimit(`pincode:${await clientIp()}`, 30, 300))) return { ok: false, message: "Too many checks. Please wait a few minutes." };
  try {
    return { ok: true, result: await shippingProvider().checkServiceability(pin) };
  } catch (e) {
    console.error("[pincode]", e);
    return { ok: false, message: "Couldn't check this pincode right now." };
  }
}

// -----------------------------------------------------------------------------
// Wishlist
// -----------------------------------------------------------------------------
export async function toggleWishlist(productId: string): Promise<{ ok: boolean; saved?: boolean; signedOut?: boolean }> {
  if (!z.uuid().safeParse(productId).success) return { ok: false };
  const userId = await getUserId();
  if (!userId) return { ok: false, signedOut: true };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("wishlist_items").select("product_id").eq("user_id", userId).eq("product_id", productId).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("wishlist_items").delete().eq("user_id", userId).eq("product_id", productId);
    return { ok: !error, saved: false };
  }
  const { error } = await supabase.from("wishlist_items").insert({ user_id: userId, product_id: productId });
  return { ok: !error, saved: true };
}

export async function isWishlisted(productId: string): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("product_id").eq("user_id", userId).eq("product_id", productId).maybeSingle();
  return !!data;
}

// -----------------------------------------------------------------------------
// Reviews
// -----------------------------------------------------------------------------
const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
});

export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await getUserId();
  if (!userId) return { message: "Please sign in to write a review." };
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`review:${userId}`, 10, 3600))) return { message: "You've submitted several reviews recently. Please try later." };

  const supabase = await createClient();
  const { productId, rating, title, body } = parsed.data;
  const { data: existing } = await supabase.from("reviews").select("id").eq("product_id", productId).eq("user_id", userId).maybeSingle();
  const { error } = existing
    ? await supabase.from("reviews").update({ rating, title: title || null, body }).eq("id", existing.id)
    : await supabase.from("reviews").insert({ product_id: productId, rating, title: title || null, body });
  if (error) {
    console.error("[review]", error.message);
    return { message: "Couldn't save your review. Please try again." };
  }
  updateTag(CATALOG_TAG);
  return { ok: true, message: "Thanks! Your review will appear once it's approved." };
}
