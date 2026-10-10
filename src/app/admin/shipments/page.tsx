import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Shipments" };

export default async function ShipmentsPage() {
  await requirePermission("shipments.manage");
  const admin = createAdminClient();
  const [{ data: toShip }, { data: shipments }] = await Promise.all([
    admin.from("orders").select("id, order_number, status, created_at, shipping_address").in("status", ["confirmed", "processing"]).order("created_at").limit(100),
    admin.from("shipments").select("id, awb, courier_name, status, provider, created_at, orders(id, order_number)").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Shipments"
        description="Enter courier + AWB from each order page. Automatic booking, labels and tracking turn on when Shipmozo is connected."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-5 py-4 font-sans text-base font-medium">Ready to ship ({toShip?.length ?? 0})</h2>
          <ul className="divide-y text-sm">
            {(toShip ?? []).map((o) => {
              const a = o.shipping_address as { name?: string; city?: string; pincode?: string };
              return (
                <li key={o.id} className="flex justify-between gap-3 px-5 py-3">
                  <span>
                    <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                      {o.order_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {a.name} · {a.city} {a.pincode}
                    </span>
                  </span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {o.status === "processing" ? "Packed" : "Confirmed"}
                    <span className="block">{formatDateTime(o.created_at)}</span>
                  </span>
                </li>
              );
            })}
            {(!toShip || toShip.length === 0) && <li className="px-5 py-8 text-center text-muted-foreground">All caught up.</li>}
          </ul>
        </section>
        <section className="rounded-md border bg-card">
          <h2 className="border-b px-5 py-4 font-sans text-base font-medium">In transit</h2>
          <ul className="divide-y text-sm">
            {(shipments ?? []).map((s) => {
              const o = s.orders as { id: string; order_number: string } | null;
              return (
                <li key={s.id} className="flex justify-between gap-3 px-5 py-3">
                  <span>
                    <Link href={`/admin/orders/${o?.id}`} className="font-medium hover:underline">
                      {o?.order_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {s.courier_name} · {s.awb}
                    </span>
                  </span>
                  <span className="text-xs capitalize">{s.status.replace(/_/g, " ")}</span>
                </li>
              );
            })}
            {(!shipments || shipments.length === 0) && <li className="px-5 py-8 text-center text-muted-foreground">No active shipments.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
