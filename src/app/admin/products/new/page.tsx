import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-forms";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission("products.manage");
  const { data: collections } = await createAdminClient().from("collections").select("id, name").order("sort");
  return (
    <>
      <Link href="/admin/products" className="text-xs text-muted-foreground hover:text-foreground">
        ← Products
      </Link>
      <AdminPageHeader title="New product" description="After creating it, add sizes, prices, stock and images." />
      <section className="rounded-md border bg-card p-5 sm:p-6">
        <ProductForm collections={collections ?? []} />
      </section>
    </>
  );
}
