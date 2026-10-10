"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StarIcon, Trash2Icon } from "lucide-react";
import { deleteProductImage, makePrimaryImage, saveProduct, saveVariant, uploadProductImage } from "@/lib/admin/catalog";
import type { FormState } from "@/lib/validation/auth";
import { CheckboxField, Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Label } from "@/components/ui/label";
import { productImageUrl } from "@/lib/images";

export type ProductFormData = {
  id?: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  gender: string;
  concentration: string;
  hsn_code: string;
  gst_rate: number;
  is_gift_set: boolean;
  is_featured: boolean;
  is_active: boolean;
  collections: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
};

const selectCls = "h-11 rounded-lg border border-input bg-card px-3 text-sm";

function useSavedToast(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
}

export function ProductForm({ product, collections }: { product?: ProductFormData; collections: { id: string; name: string }[] }) {
  const [state, action] = useActionState(saveProduct, {} as FormState);
  useSavedToast(state);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const val = (k: string, fallback: string) => v?.[k] ?? fallback;
  const checked = (k: string, fallback: boolean) => (v ? v[k] === "on" : fallback);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {product?.id && <input type="hidden" name="id" value={product.id} />}
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <Field name="name" label="Name" defaultValue={val("name", product?.name ?? "")} errors={e.name} />
      <Field name="slug" label="URL slug" defaultValue={val("slug", product?.slug ?? "")} hint="Leave empty to generate from the name" errors={e.slug} />
      <Field className="sm:col-span-2" name="tagline" label="Tagline" defaultValue={val("tagline", product?.tagline ?? "")} errors={e.tagline} />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="f-description">Description</Label>
        <textarea id="f-description" name="description" rows={5} maxLength={4000} defaultValue={val("description", product?.description ?? "")} className="rounded-lg border border-input bg-card px-3 py-2 text-sm" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-gender">For</Label>
        <select id="f-gender" name="gender" defaultValue={val("gender", product?.gender ?? "unisex")} className={selectCls}>
          <option value="men">Men</option>
          <option value="women">Women</option>
          <option value="unisex">Unisex</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="f-concentration">Concentration</Label>
        <select id="f-concentration" name="concentration" defaultValue={val("concentration", product?.concentration ?? "edp")} className={selectCls}>
          <option value="parfum">Parfum</option>
          <option value="edp">Eau de Parfum</option>
          <option value="edt">Eau de Toilette</option>
          <option value="edc">Eau de Cologne</option>
          <option value="attar">Attar</option>
          <option value="body_mist">Body mist</option>
        </select>
      </div>
      <Field name="notesTop" label="Top notes (comma-separated)" defaultValue={val("notesTop", product?.notes.top.join(", ") ?? "")} />
      <Field name="notesHeart" label="Heart notes" defaultValue={val("notesHeart", product?.notes.heart.join(", ") ?? "")} />
      <Field name="notesBase" label="Base notes" defaultValue={val("notesBase", product?.notes.base.join(", ") ?? "")} />
      <div className="grid grid-cols-2 gap-4">
        <Field name="hsnCode" label="HSN code" defaultValue={val("hsnCode", product?.hsn_code ?? "33030090")} errors={e.hsnCode} />
        <Field name="gstRate" label="GST %" type="number" step="0.01" defaultValue={val("gstRate", String(product?.gst_rate ?? 18))} errors={e.gstRate} />
      </div>
      <fieldset className="grid gap-2 sm:col-span-2">
        <legend className="mb-1 text-sm font-medium">Collections</legend>
        <div className="flex flex-wrap gap-4">
          {collections.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="collections" value={c.id} defaultChecked={product?.collections.includes(c.id)} className="size-4 accent-[var(--primary)]" />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <CheckboxField name="isActive" defaultChecked={checked("isActive", product?.is_active ?? false)}>
          Live on the store
        </CheckboxField>
        <CheckboxField name="isFeatured" defaultChecked={checked("isFeatured", product?.is_featured ?? false)}>
          Featured
        </CheckboxField>
        <CheckboxField name="isGiftSet" defaultChecked={checked("isGiftSet", product?.is_gift_set ?? false)}>
          Gift set
        </CheckboxField>
      </div>
      <SubmitButton className="w-fit" pendingText="Saving…">
        {product?.id ? "Save product" : "Create product"}
      </SubmitButton>
    </form>
  );
}

export type VariantRow = { id: string; sku: string; label: string; size_ml: number; price: number; mrp: number; stock: number; weight_g: number; sort: number; is_active: boolean };

export function VariantForm({ productId, variant }: { productId: string; variant?: VariantRow }) {
  const [state, action] = useActionState(saveVariant, {} as FormState);
  useSavedToast(state);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !variant) formRef.current?.reset();
  }, [state, variant]);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const d = (k: string, fallback: string) => v?.[k] ?? fallback;

  return (
    <form ref={formRef} action={action} className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8" noValidate>
      <input type="hidden" name="productId" value={productId} />
      {variant && <input type="hidden" name="id" value={variant.id} />}
      <Field name="sku" label="SKU" defaultValue={d("sku", variant?.sku ?? "")} errors={e.sku} />
      <Field name="label" label="Label" placeholder="100 ml" defaultValue={d("label", variant?.label ?? "")} errors={e.label} />
      <Field name="sizeMl" label="Size (ml)" type="number" defaultValue={d("sizeMl", variant ? String(variant.size_ml) : "")} errors={e.sizeMl} />
      <Field name="price" label="Price (₹)" type="number" step="0.01" defaultValue={d("price", variant ? String(variant.price / 100) : "")} errors={e.price} />
      <Field name="mrp" label="MRP (₹)" type="number" step="0.01" defaultValue={d("mrp", variant ? String(variant.mrp / 100) : "")} errors={e.mrp} />
      {variant ? (
        <div className="grid gap-1.5">
          <Label>Stock</Label>
          <p className="flex h-11 items-center text-sm text-muted-foreground">{variant.stock} (use Inventory)</p>
        </div>
      ) : (
        <Field name="stock" label="Opening stock" type="number" min="0" defaultValue={d("stock", "0")} errors={e.stock} />
      )}
      <Field name="weightG" label="Weight (g)" type="number" defaultValue={d("weightG", variant ? String(variant.weight_g) : "350")} errors={e.weightG} />
      <div className="grid content-end gap-2">
        <CheckboxField name="isActive" defaultChecked={variant?.is_active ?? true}>
          Active
        </CheckboxField>
        <input type="hidden" name="sort" value={variant?.sort ?? 0} />
        <SubmitButton size="sm" className="w-full" pendingText="…">
          {variant ? "Save" : "Add size"}
        </SubmitButton>
      </div>
      {state.message && !state.ok && <p className="col-span-full text-sm text-destructive">{state.message}</p>}
    </form>
  );
}

export function ImageManager({ productId, images }: { productId: string; images: { id: string; storage_path: string; alt: string | null }[] }) {
  const [state, action] = useActionState(uploadProductImage, {} as FormState);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message);
      formRef.current?.reset();
      router.refresh();
    } else if (state.message) toast.error(state.message);
  }, [state, router]);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {images.map((img, i) => (
          <div key={img.id} className="group relative aspect-[4/5] overflow-hidden rounded border bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={productImageUrl(img.storage_path)} alt={img.alt ?? ""} className="size-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10px] text-primary-foreground">Main</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {i > 0 ? (
                <button type="button" aria-label="Make main image" disabled={pending} onClick={() => startTransition(async () => void (await makePrimaryImage(img.id), router.refresh()))} className="p-1">
                  <StarIcon className="size-4" />
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                aria-label="Delete image"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this image?")) startTransition(async () => void (await deleteProductImage(img.id), router.refresh()));
                }}
                className="p-1 text-destructive"
              >
                <Trash2Icon className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {images.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No images yet.</p>}
      </div>
      <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-1.5">
          <Label htmlFor="img-file">Upload image (JPG, PNG, WebP · max 5 MB)</Label>
          <input id="img-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required className="text-sm file:mr-3 file:rounded file:border file:bg-card file:px-3 file:py-1.5" />
        </div>
        <input name="alt" placeholder="Alt text (optional)" maxLength={160} className="h-10 rounded-md border bg-card px-3 text-sm" />
        <SubmitButton variant="outline" className="w-fit" pendingText="Uploading…">
          Upload
        </SubmitButton>
      </form>
    </div>
  );
}
