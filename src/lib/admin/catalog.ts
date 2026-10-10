"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/images";
import { rupeesToPaise } from "@/lib/money";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/auth";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const noteList = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12),
  );

const productSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Enter a name").max(100),
  slug: z.string().trim().max(80).optional(),
  tagline: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  gender: z.enum(["men", "women", "unisex"]),
  concentration: z.enum(["parfum", "edp", "edt", "edc", "attar", "body_mist"]),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN must be 4–8 digits"),
  gstRate: z.coerce.number().min(0).max(28),
  isGiftSet: z.literal("on").optional(),
  isFeatured: z.literal("on").optional(),
  isActive: z.literal("on").optional(),
  notesTop: noteList,
  notesHeart: noteList,
  notesBase: noteList,
});

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("products.manage");
  const values = formValues(formData);
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const p = parsed.data;
  const slug = slugify(p.slug || p.name);
  if (!slug) return { fieldErrors: { slug: ["Enter a valid URL slug"] }, values };

  const admin = createAdminClient();
  const row = {
    name: p.name,
    slug,
    tagline: p.tagline || null,
    description: p.description || null,
    gender: p.gender,
    concentration: p.concentration,
    hsn_code: p.hsnCode,
    gst_rate: p.gstRate,
    is_gift_set: p.isGiftSet === "on",
    is_featured: p.isFeatured === "on",
    is_active: p.isActive === "on",
  };
  const { data, error } = p.id
    ? await admin.from("products").update(row).eq("id", p.id).select("id").single()
    : await admin.from("products").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return { fieldErrors: { slug: ["Another product already uses this URL slug"] }, values };
    console.error("[admin] product", error.message);
    return { message: "Couldn't save the product.", values };
  }
  const productId = data.id;

  // Collections
  const collections = formData.getAll("collections").filter((c): c is string => typeof c === "string" && z.uuid().safeParse(c).success);
  await admin.from("product_collections").delete().eq("product_id", productId);
  if (collections.length) await admin.from("product_collections").insert(collections.map((collection_id) => ({ product_id: productId, collection_id })));

  // Notes (created on the fly; new notes get family "Other" and can be renamed in SQL)
  const tiers = { top: p.notesTop, heart: p.notesHeart, base: p.notesBase } as const;
  const names = [...new Set(Object.values(tiers).flat())];
  if (names.length) await admin.from("notes").upsert(names.map((name) => ({ name, family: "Other" })), { onConflict: "name", ignoreDuplicates: true });
  const { data: noteRows } = names.length ? await admin.from("notes").select("id, name").in("name", names) : { data: [] };
  const idOf = new Map((noteRows ?? []).map((n) => [n.name, n.id]));
  await admin.from("product_notes").delete().eq("product_id", productId);
  const noteLinks = (Object.entries(tiers) as ["top" | "heart" | "base", string[]][]).flatMap(([tier, list]) =>
    list.filter((n) => idOf.has(n)).map((n) => ({ product_id: productId, note_id: idOf.get(n)!, tier })),
  );
  if (noteLinks.length) await admin.from("product_notes").upsert(noteLinks, { ignoreDuplicates: true });

  await admin.rpc("audit", { p_actor: user.id, p_action: p.id ? "product.updated" : "product.created", p_entity: "product", p_entity_id: productId, p_details: row });
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/products");
  if (!p.id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: true, message: "Product saved.", values };
}

const variantSchema = z
  .object({
    id: z.uuid().optional(),
    productId: z.uuid(),
    sku: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/, "Use letters, numbers and dashes"),
    label: z.string().trim().min(1, "Enter a label, e.g. 100 ml").max(40),
    sizeMl: z.coerce.number().int().positive("Enter size in ml"),
    price: z.coerce.number().positive("Enter the selling price"),
    mrp: z.coerce.number().positive("Enter the MRP"),
    stock: z.coerce.number().int().min(0).optional(),
    weightG: z.coerce.number().int().positive("Enter packed weight in grams"),
    sort: z.coerce.number().int().min(0).default(0),
    isActive: z.literal("on").optional(),
  })
  .refine((v) => v.price <= v.mrp, { path: ["price"], message: "Price can't be more than MRP" });

export async function saveVariant(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("products.manage");
  const values = formValues(formData);
  const parsed = variantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;

  const admin = createAdminClient();
  const row = {
    product_id: v.productId,
    sku: v.sku,
    label: v.label,
    size_ml: v.sizeMl,
    price: rupeesToPaise(v.price),
    mrp: rupeesToPaise(v.mrp),
    weight_g: v.weightG,
    sort: v.sort,
    is_active: v.isActive === "on",
  };
  // Stock is only set on creation; afterwards it changes through Inventory (audited movements).
  const { data, error } = v.id
    ? await admin.from("product_variants").update(row).eq("id", v.id).select("id").single()
    : await admin.from("product_variants").insert({ ...row, stock: v.stock ?? 0 }).select("id").single();
  if (error) {
    if (error.code === "23505") return { fieldErrors: { sku: ["This SKU already exists"] }, values };
    console.error("[admin] variant", error.message);
    return { message: "Couldn't save the size.", values };
  }
  if (!v.id && (v.stock ?? 0) > 0) {
    await admin.from("inventory_movements").insert({ variant_id: data.id, delta: v.stock!, reason: "restock", actor: user.id });
  }
  await admin.rpc("audit", { p_actor: user.id, p_action: v.id ? "variant.updated" : "variant.created", p_entity: "variant", p_entity_id: data.id, p_details: row });
  updateTag(CATALOG_TAG);
  revalidatePath(`/admin/products/${v.productId}`);
  return { ok: true, message: v.id ? "Size updated." : "Size added." };
}

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export async function uploadProductImage(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission("products.manage");
  const productId = z.uuid().safeParse(formData.get("productId")).data;
  const file = formData.get("file");
  if (!productId || !(file instanceof File) || file.size === 0) return { message: "Choose an image to upload." };
  const ext = ALLOWED.get(file.type);
  if (!ext) return { message: "Use a JPG, PNG, WebP or AVIF image." };
  if (file.size > 5 * 1024 * 1024) return { message: "Images must be under 5 MB." };

  const admin = createAdminClient();
  const path = `products/${productId}/${randomUUID()}.${ext}`;
  const { error: upErr } = await admin.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (upErr) {
    console.error("[admin] upload", upErr.message);
    return { message: "Upload failed. Please try again." };
  }
  const { count } = await admin.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const alt = String(formData.get("alt") ?? "").slice(0, 160) || null;
  await admin.from("product_images").insert({ product_id: productId, storage_path: path, alt, sort: count ?? 0 });
  await admin.rpc("audit", { p_actor: user.id, p_action: "product.image_added", p_entity: "product", p_entity_id: productId, p_details: { path } });
  updateTag(CATALOG_TAG);
  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, message: "Image uploaded." };
}

export async function deleteProductImage(imageId: string): Promise<{ ok: boolean }> {
  const user = await requirePermission("products.manage");
  if (!z.uuid().safeParse(imageId).success) return { ok: false };
  const admin = createAdminClient();
  const { data: img } = await admin.from("product_images").select("product_id, storage_path").eq("id", imageId).single();
  if (!img) return { ok: false };
  if (!img.storage_path.startsWith("/") && !img.storage_path.startsWith("http")) {
    await admin.storage.from(PRODUCT_IMAGES_BUCKET).remove([img.storage_path]);
  }
  await admin.from("product_images").delete().eq("id", imageId);
  await admin.rpc("audit", { p_actor: user.id, p_action: "product.image_removed", p_entity: "product", p_entity_id: img.product_id, p_details: { path: img.storage_path } });
  updateTag(CATALOG_TAG);
  revalidatePath(`/admin/products/${img.product_id}`);
  return { ok: true };
}

export async function makePrimaryImage(imageId: string): Promise<{ ok: boolean }> {
  await requirePermission("products.manage");
  const admin = createAdminClient();
  const { data: img } = await admin.from("product_images").select("product_id").eq("id", imageId).single();
  if (!img) return { ok: false };
  const { data: all } = await admin.from("product_images").select("id").eq("product_id", img.product_id).order("sort");
  const ordered = [imageId, ...(all ?? []).map((i) => i.id).filter((id) => id !== imageId)];
  await Promise.all(ordered.map((id, sort) => admin.from("product_images").update({ sort }).eq("id", id)));
  updateTag(CATALOG_TAG);
  revalidatePath(`/admin/products/${img.product_id}`);
  return { ok: true };
}
