"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { rupeesToPaise } from "@/lib/money";
import { INDIAN_STATES } from "@/lib/validation/address";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/auth";

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------
const stockSchema = z.object({
  variantId: z.uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero change").refine((n) => Math.abs(n) <= 10000, "Too large"),
  reason: z.enum(["restock", "adjust"]),
  note: z.string().trim().max(200).optional(),
});

export async function adjustStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("inventory.adjust");
  const parsed = stockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { variantId, delta, reason, note } = parsed.data;
  const { data, error } = await createAdminClient().rpc("adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_actor: user.id,
    p_note: note ?? (undefined as unknown as string),
  });
  if (error) return { message: error.message.includes("NEGATIVE") ? "Stock can't go below zero." : "Couldn't adjust stock." };
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/inventory");
  return { ok: true, message: `Stock updated to ${data}.` };
}

// -----------------------------------------------------------------------------
// Coupons
// -----------------------------------------------------------------------------
const optionalNumber = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().nonnegative().optional());
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional());

const couponSchema = z
  .object({
    id: z.uuid().optional(),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "3–30 letters, numbers, - or _"),
    description: z.string().trim().max(160).optional(),
    type: z.enum(["percent", "flat", "free_shipping"]),
    value: optionalNumber,
    maxDiscount: optionalNumber,
    minOrder: optionalNumber,
    startsAt: optionalDate,
    endsAt: optionalDate,
    usageLimit: optionalNumber,
    perUserLimit: z.coerce.number().int().min(1).max(100).default(1),
    firstOrderOnly: z.literal("on").optional(),
    isActive: z.literal("on").optional(),
  })
  .refine((c) => c.type !== "percent" || (c.value != null && c.value >= 1 && c.value <= 100), { path: ["value"], message: "Percent must be 1–100" })
  .refine((c) => c.type !== "flat" || (c.value != null && c.value > 0), { path: ["value"], message: "Enter the discount amount" })
  .refine((c) => !c.startsAt || !c.endsAt || c.endsAt > c.startsAt, { path: ["endsAt"], message: "End must be after start" });

export async function saveCoupon(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("coupons.manage");
  const values = formValues(formData);
  const parsed = couponSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const c = parsed.data;
  const row = {
    code: c.code,
    description: c.description || null,
    type: c.type,
    value: c.type === "percent" ? Math.round(c.value!) : c.type === "flat" ? rupeesToPaise(c.value!) : 0,
    max_discount: c.type === "percent" && c.maxDiscount ? rupeesToPaise(c.maxDiscount) : null,
    min_order: c.minOrder ? rupeesToPaise(c.minOrder) : 0,
    starts_at: c.startsAt?.toISOString() ?? null,
    ends_at: c.endsAt?.toISOString() ?? null,
    usage_limit: c.usageLimit ? Math.round(c.usageLimit) : null,
    per_user_limit: c.perUserLimit,
    first_order_only: c.firstOrderOnly === "on",
    is_active: c.isActive === "on",
  };
  const admin = createAdminClient();
  const { data, error } = c.id
    ? await admin.from("coupons").update(row).eq("id", c.id).select("id").single()
    : await admin.from("coupons").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return { fieldErrors: { code: ["This code already exists"] }, values };
    console.error("[admin] coupon", error.message);
    return { message: "Couldn't save the coupon.", values };
  }
  await admin.rpc("audit", { p_actor: user.id, p_action: c.id ? "coupon.updated" : "coupon.created", p_entity: "coupon", p_entity_id: data.id, p_details: row });
  revalidatePath("/admin/coupons");
  if (!c.id) redirect("/admin/coupons");
  return { ok: true, message: "Coupon saved.", values };
}

// -----------------------------------------------------------------------------
// Reviews
// -----------------------------------------------------------------------------
export async function moderateReview(reviewId: string, status: "approved" | "rejected"): Promise<{ ok: boolean }> {
  const user = await requirePermission("reviews.moderate");
  if (!z.uuid().safeParse(reviewId).success || !["approved", "rejected"].includes(status)) return { ok: false };
  const admin = createAdminClient();
  const { error } = await admin.from("reviews").update({ status }).eq("id", reviewId);
  await admin.rpc("audit", { p_actor: user.id, p_action: `review.${status}`, p_entity: "review", p_entity_id: reviewId });
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/reviews");
  return { ok: !error };
}

// -----------------------------------------------------------------------------
// Settings
// -----------------------------------------------------------------------------
const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(80),
  legalName: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  state: z.enum(INDIAN_STATES),
  supportEmail: z.email(),
  supportPhone: z.string().trim().min(8).max(20),
  shippingFee: z.coerce.number().min(0).max(10000),
  freeAbove: z.coerce.number().min(0).max(1000000),
  codEnabled: z.literal("on").optional(),
  codFee: z.coerce.number().min(0).max(10000),
  codMax: z.coerce.number().min(0).max(1000000),
  holdMinutes: z.coerce.number().int().min(15, "At least 15 minutes (Cashfree minimum)").max(120),
});

export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("settings.manage");
  const values = formValues(formData);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const s = parsed.data;
  const rows = [
    {
      key: "store",
      value: {
        name: s.storeName,
        legal_name: s.legalName || null,
        address: s.address || null,
        state: s.state,
        support_email: s.supportEmail,
        support_phone: s.supportPhone,
      },
    },
    { key: "shipping", value: { flat_fee: rupeesToPaise(s.shippingFee), free_above: rupeesToPaise(s.freeAbove) } },
    { key: "cod", value: { enabled: s.codEnabled === "on", fee: rupeesToPaise(s.codFee), max_order: rupeesToPaise(s.codMax) } },
    { key: "checkout", value: { hold_minutes: s.holdMinutes } },
  ];
  const admin = createAdminClient();
  const { error } = await admin.from("store_settings").upsert(rows, { onConflict: "key" });
  if (error) return { message: "Couldn't save settings.", values };
  await admin.rpc("audit", { p_actor: user.id, p_action: "settings.updated", p_entity: "settings", p_entity_id: "store", p_details: Object.fromEntries(rows.map((r) => [r.key, r.value])) });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved.", values };
}
