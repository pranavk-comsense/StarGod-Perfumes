import Link from "next/link";
import { cn } from "cn";
import { requirePermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { formatDateTime, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from "@/lib/orders/format";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { AdminPageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Orders" };

const FILTERS: (OrderStatus | "all")[] = ["all", "confirmed", "processing", "shipped", "delivered", "pending_payment", "cancelled"];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requirePermission("orders.view");
  const sp = await searchParams;
  const raw = sp.status;
  const status = FILTERS.includes(raw as OrderStatus) ? (raw as OrderStatus | "all") : "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30) : "";

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, total, created_at, shipping_address, order_items(qty)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("order_number", `%${q}%`);
  const { data: orders, error } = await query;

  return (
    <>
      <AdminPageHeader title="Orders" description="Open an order to pack, ship, track, cancel or refund it.">
        <form className="flex gap-2" role="search">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search order no." className="h-10 w-48 rounded-md border bg-card px-3 text-sm" />
        </form>
      </AdminPageHeader>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/orders" : `/admin/orders?status=${f}`}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs",
              f === status ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/30",
            )}
          >
            {f === "all" ? "All" : ORDER_STATUS_LABEL[f]}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border bg-card">
        {error ? (
          <p className="p-6 text-sm text-destructive">Couldn&apos;t load orders.</p>
        ) : orders && orders.length > 0 ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => {
                const addr = o.shipping_address as { name?: string; city?: string; pincode?: string };
                return (
                  <tr key={o.id}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                        {o.order_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p>{addr?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {addr?.city} {addr?.pincode}
                      </p>
                    </td>
                    <td className="px-5 py-3">{o.order_items.reduce((n, i) => n + i.qty, 0)}</td>
                    <td className="px-5 py-3">
                      {o.payment_method === "cod" ? "COD" : "Prepaid"}
                      <span className="block text-xs text-muted-foreground">{PAYMENT_STATUS_LABEL[o.payment_status]}</span>
                    </td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium">{formatINR(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-10 text-center text-sm text-muted-foreground">No orders match this filter.</p>
        )}
      </div>
    </>
  );
}
