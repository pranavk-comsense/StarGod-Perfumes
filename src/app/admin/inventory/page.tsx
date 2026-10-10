import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StockAdjustForm } from "@/components/admin/ops-forms";
import { cn } from "cn";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  await requirePermission("inventory.adjust");
  const low = (await searchParams).low === "1";
  const admin = createAdminClient();
  let q = admin.from("product_variants").select("id, sku, label, stock, is_active, products(name, is_active)").order("stock").limit(300);
  if (low) q = q.lte("stock", 5);
  const [{ data: variants }, { data: movements }] = await Promise.all([
    q,
    admin.from("inventory_movements").select("id, delta, reason, order_id, actor, created_at, product_variants(sku)").order("created_at", { ascending: false }).limit(15),
  ]);

  return (
    <>
      <AdminPageHeader title="Inventory" description="Every change is logged. Orders and cancellations update stock automatically.">
        <div className="flex gap-2 text-sm">
          <a href="/admin/inventory" className={cn("rounded-full border px-3 py-1.5", !low && "bg-primary text-primary-foreground")}>
            All
          </a>
          <a href="/admin/inventory?low=1" className={cn("rounded-full border px-3 py-1.5", low && "bg-primary text-primary-foreground")}>
            Low stock
          </a>
        </div>
      </AdminPageHeader>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-md border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Product / size</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(variants ?? []).map((v) => {
                const product = v.products as { name: string; is_active: boolean } | null;
                return (
                  <tr key={v.id} className={!v.is_active || !product?.is_active ? "opacity-60" : undefined}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{product?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.label} · {v.sku}
                        {!v.is_active && " · inactive"}
                      </p>
                    </td>
                    <td className={cn("px-4 py-3 text-base font-medium tabular-nums", v.stock === 0 ? "text-destructive" : v.stock <= 5 && "text-amber-700")}>{v.stock}</td>
                    <td className="px-4 py-3">
                      <StockAdjustForm variantId={v.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <section className="h-fit rounded-md border bg-card">
          <h2 className="border-b px-4 py-3 font-sans text-sm font-medium">Recent movements</h2>
          <ul className="divide-y text-sm">
            {(movements ?? []).map((m) => (
              <li key={m.id} className="flex justify-between gap-2 px-4 py-2.5">
                <span>
                  {(m.product_variants as { sku: string } | null)?.sku} · <span className="capitalize">{m.reason}</span>
                  <span className="block text-xs text-muted-foreground">{formatDateTime(m.created_at)}</span>
                </span>
                <span className={m.delta > 0 ? "text-success" : "text-destructive"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
