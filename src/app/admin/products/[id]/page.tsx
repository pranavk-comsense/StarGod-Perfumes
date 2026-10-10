import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExternalLinkIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ImageManager, ProductForm, VariantForm } from "@/components/admin/product-forms";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requirePermission("products.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const admin = createAdminClient();
  const [{ data: p }, { data: collections }] = await Promise.all([
    admin
      .from("products")
      .select(
        `id, name, slug, tagline, description, gender, concentration, hsn_code, gst_rate, is_gift_set, is_featured, is_active,
         product_collections(collection_id), product_notes(tier, notes(name)),
         product_variants(id, sku, label, size_ml, price, mrp, stock, weight_g, sort, is_active),
         product_images(id, storage_path, alt, sort)`,
      )
      .eq("id", id)
      .maybeSingle(),
    admin.from("collections").select("id, name").order("sort"),
  ]);
  if (!p) notFound();

  const notes = { top: [] as string[], heart: [] as string[], base: [] as string[] };
  for (const n of p.product_notes) if (n.notes) notes[n.tier].push(n.notes.name);
  const variants = [...p.product_variants].sort((a, b) => a.sort - b.sort || a.size_ml - b.size_ml);

  return (
    <>
      <Link href="/admin/products" className="text-xs text-muted-foreground hover:text-foreground">
        ← Products
      </Link>
      <AdminPageHeader title={p.name} description={p.is_active ? "Live on the store" : "Hidden from the store"}>
        <Link href={`/products/${p.slug}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
          View on store <ExternalLinkIcon />
        </Link>
      </AdminPageHeader>

      <div className="grid gap-6">
        <section className="rounded-md border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-sans text-base font-medium">Sizes &amp; prices</h2>
          <div className="grid gap-5 divide-y">
            {variants.map((v) => (
              <div key={v.id} className="pt-5 first:pt-0">
                <VariantForm productId={p.id} variant={v} />
              </div>
            ))}
            <div className="pt-5">
              <p className="mb-3 text-sm font-medium">Add a size</p>
              <VariantForm productId={p.id} />
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-sans text-base font-medium">Images</h2>
          <ImageManager productId={p.id} images={[...p.product_images].sort((a, b) => a.sort - b.sort)} />
        </section>

        <section className="rounded-md border bg-card p-5 sm:p-6">
          <h2 className="mb-4 font-sans text-base font-medium">Details</h2>
          <ProductForm
            collections={collections ?? []}
            product={{
              id: p.id,
              name: p.name,
              slug: p.slug,
              tagline: p.tagline,
              description: p.description,
              gender: p.gender,
              concentration: p.concentration,
              hsn_code: p.hsn_code,
              gst_rate: Number(p.gst_rate),
              is_gift_set: p.is_gift_set,
              is_featured: p.is_featured,
              is_active: p.is_active,
              collections: p.product_collections.map((c) => c.collection_id),
              notes,
            }}
          />
        </section>
      </div>
    </>
  );
}
