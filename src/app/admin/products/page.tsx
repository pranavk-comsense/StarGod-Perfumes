import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/money";
import { productImageUrl } from "@/lib/images";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Products" };

export default async function AdminProductsPage() {
  await requirePermission("products.manage");
  const { data: products } = await createAdminClient()
    .from("products")
    .select("id, name, slug, gender, concentration, is_active, is_featured, rating_avg, rating_count, product_variants(price, stock, is_active), product_images(storage_path, sort)")
    .order("created_at", { ascending: false });

  return (
    <>
      <AdminPageHeader title="Products" description={`${products?.length ?? 0} products`}>
        <Link href="/admin/products/new" className={buttonVariants()}>
          <PlusIcon /> New product
        </Link>
      </AdminPageHeader>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Product</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Stock</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(products ?? []).map((p) => {
              const variants = p.product_variants.filter((v) => v.is_active);
              const prices = variants.map((v) => v.price);
              const stock = variants.reduce((n, v) => n + v.stock, 0);
              const img = [...p.product_images].sort((a, b) => a.sort - b.sort)[0]?.storage_path;
              return (
                <tr key={p.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={productImageUrl(img)} alt="" className="size-10 rounded object-cover" />
                      <span>
                        <span className="font-medium hover:underline">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">/{p.slug}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 capitalize">
                    {p.gender} · {p.concentration.toUpperCase()}
                  </td>
                  <td className="px-5 py-3">{prices.length ? `${formatINR(Math.min(...prices))}${prices.length > 1 ? ` – ${formatINR(Math.max(...prices))}` : ""}` : "—"}</td>
                  <td className={stock === 0 ? "px-5 py-3 font-medium text-destructive" : "px-5 py-3"}>{stock}</td>
                  <td className="px-5 py-3">
                    <span className={p.is_active ? "text-success" : "text-muted-foreground"}>{p.is_active ? "Live" : "Hidden"}</span>
                    {p.is_featured && <span className="ml-2 text-xs text-gold">Featured</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
