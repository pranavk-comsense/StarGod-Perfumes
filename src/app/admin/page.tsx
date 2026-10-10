import Link from "next/link";
import { AlertTriangleIcon, IndianRupeeIcon, PackageCheckIcon, ReceiptIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { daysAgoISO, formatDateTime, istStartOfToday } from "@/lib/orders/format";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Dashboard" };

const LOW_STOCK = 5;

export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const showRevenue = can(user.role, "dashboard.revenue");
  const supabase = await createClient();

  const since = daysAgoISO(30);
  const startOfDay = istStartOfToday();

  const [today, toShip, lowStock, recent, revenue] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfDay).not("status", "in", "(pending_payment,payment_failed)"),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["confirmed", "processing"]),
    supabase
      .from("product_variants")
      .select("id, sku, label, stock, products(name)")
      .eq("is_active", true)
      .lte("stock", LOW_STOCK)
      .order("stock")
      .limit(8),
    supabase
      .from("orders")
      .select("id, order_number, status, total, payment_method, created_at, shipping_address")
      .order("created_at", { ascending: false })
      .limit(8),
    showRevenue
      ? supabase.from("orders").select("total").eq("payment_status", "paid").gte("created_at", since)
      : Promise.resolve({ data: null }),
  ]);

  const revenue30 = (revenue.data ?? []).reduce((sum, o) => sum + (o as { total: number }).total, 0);

  return (
    <>
      <AdminPageHeader title={`Welcome, ${user.fullName?.split(" ")[0] ?? "team"}`} description="Here's what needs your attention today." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ReceiptIcon} label="Orders today" value={String(today.count ?? 0)} />
        <Stat icon={PackageCheckIcon} label="To pack & ship" value={String(toShip.count ?? 0)} href="/admin/orders?status=confirmed" />
        <Stat icon={AlertTriangleIcon} label={`Low stock (≤ ${LOW_STOCK})`} value={String(lowStock.data?.length ?? 0)} />
        {showRevenue && <Stat icon={IndianRupeeIcon} label="Paid revenue, 30 days" value={formatINR(revenue30)} />}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-sans text-base font-medium">Recent orders</h2>
            <Link href="/admin/orders" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
          {recent.data && recent.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Order</th>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recent.data.map((o) => (
                    <tr key={o.id}>
                      <td className="px-5 py-3">
                        <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                          {o.order_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</p>
                      </td>
                      <td className="px-5 py-3">{(o.shipping_address as { name?: string })?.name ?? "—"}</td>
                      <td className="px-5 py-3">
                        <OrderStatusBadge status={o.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatINR(o.total)}
                        <span className="block text-xs text-muted-foreground">{o.payment_method === "cod" ? "COD" : "Prepaid"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No orders yet. They&apos;ll appear here as soon as customers check out.</p>
          )}
        </section>

        <section className="rounded-md border bg-card">
          <h2 className="border-b px-5 py-4 font-sans text-base font-medium">Low stock</h2>
          {lowStock.data && lowStock.data.length > 0 ? (
            <ul className="divide-y text-sm">
              {lowStock.data.map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p>{(v.products as { name: string } | null)?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.label} · {v.sku}
                    </p>
                  </div>
                  <span className={v.stock === 0 ? "font-medium text-destructive" : "font-medium text-amber-700"}>
                    {v.stock === 0 ? "Out" : v.stock}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">All variants are well stocked.</p>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, href }: { icon: typeof ReceiptIcon; label: string; value: string; href?: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="text-sm">{label}</p>
        <Icon className="size-4" />
      </div>
      <p className="mt-3 font-heading text-4xl">{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="rounded-md border bg-card p-5 transition-colors hover:border-foreground/30">
      {body}
    </Link>
  ) : (
    <div className="rounded-md border bg-card p-5">{body}</div>
  );
}
