import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { NdrButtons, SyncTrackingButton } from "@/components/admin/shipmozo-forms";
import { getNdrs, isShipmozoConfigured, type Ndr } from "@/lib/shipping/shipmozo";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Shipments" };

export default async function ShipmentsPage() {
  await requirePermission("shipments.manage");
  const shipmozo = isShipmozoConfigured();
  const admin = createAdminClient();
  const [{ data: toShip }, { data: shipments }, { data: returns }, ndr] = await Promise.all([
    admin.from("orders").select("id, order_number, status, created_at, shipping_address").in("status", ["confirmed", "processing"]).order("created_at").limit(100),
    admin.from("shipments").select("id, awb, courier_name, status, provider, created_at, orders(id, order_number)").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
    admin.from("return_shipments").select("id, awb, courier_name, status, reason, customer_request, created_at, orders(id, order_number)").eq("is_active", true).neq("status", "delivered").order("created_at", { ascending: false }).limit(50),
    shipmozo ? getNdrs().then((list): { list: Ndr[]; error?: string } => ({ list })).catch((e: Error) => ({ list: [] as Ndr[], error: e.message })) : Promise.resolve(null),
  ]);
  const ndrOrders = new Map((shipments ?? []).filter((s) => s.awb).map((s) => [s.awb as string, s.orders as { id: string; order_number: string } | null]));
  const awaitingPickup = (shipments ?? []).filter((s) => s.provider === "shipmozo" && s.status === "shipped").length;

  return (
    <>
      <AdminPageHeader
        title="Shipments"
        description={
          shipmozo
            ? "Book couriers from each order page. Tracking syncs from Shipmozo daily, or on demand."
            : "Enter courier + AWB from each order page. Automatic booking, labels and tracking turn on when Shipmozo is connected."
        }
      />
      {shipmozo && (
        <div className="-mt-2 mb-4 flex flex-wrap gap-2">
          <SyncTrackingButton />
          {awaitingPickup > 0 && (
            <a href="/admin/shipments/manifest" target="_blank" rel="noopener" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Pickup manifest ({Math.min(awaitingPickup, 25)})
            </a>
          )}
        </div>
      )}
      {ndr && (ndr.list.length > 0 || ndr.error) && (
        <section className="mb-6 rounded-md border border-amber-300 bg-card">
          <h2 className="border-b px-5 py-4 font-sans text-base font-medium">Delivery failed: action needed ({ndr.list.length})</h2>
          {ndr.error && <p className="px-5 py-3 text-sm text-destructive">Couldn&apos;t load from Shipmozo: {ndr.error}</p>}
          <ul className="divide-y text-sm">
            {ndr.list.map((n) => {
              const o = ndrOrders.get(n.awb);
              return (
                <li key={n.awb} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <span>
                    {o ? (
                      <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                        {o.order_number}
                      </Link>
                    ) : (
                      <span className="font-medium">{n.orderId || n.awb}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      AWB {n.awb}
                      {n.reason && ` · ${n.reason}`}
                      {n.attempts && ` · attempt ${n.attempts}`}
                      {n.date && ` · ${n.date}`}
                    </span>
                  </span>
                  <NdrButtons awb={n.awb} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
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
                  <span className="text-right text-xs capitalize">
                    {s.status.replace(/_/g, " ")}
                    {s.provider === "shipmozo" && s.awb && (
                      <a href={`/admin/shipments/label/${encodeURIComponent(s.awb)}`} target="_blank" rel="noopener" className="block normal-case underline underline-offset-2">
                        Label
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
            {(!shipments || shipments.length === 0) && <li className="px-5 py-8 text-center text-muted-foreground">No active shipments.</li>}
          </ul>
        </section>
        <section className="rounded-md border bg-card xl:col-span-2">
          <h2 className="border-b px-5 py-4 font-sans text-base font-medium">Return pickups ({returns?.length ?? 0})</h2>
          <ul className="divide-y text-sm">
            {(returns ?? []).map((r) => {
              const o = r.orders as { id: string; order_number: string } | null;
              return (
                <li key={r.id} className="flex justify-between gap-3 px-5 py-3">
                  <span>
                    <Link href={`/admin/orders/${o?.id}`} className="font-medium hover:underline">
                      {o?.order_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.customer_request === "EXCHANGE" ? "Exchange" : "Refund"} · {r.reason}
                      {r.awb && ` · ${r.courier_name ?? "Courier"} ${r.awb}`}
                    </span>
                  </span>
                  <span className="text-right text-xs capitalize">
                    {r.status.replace(/_/g, " ")}
                    <span className="block text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </span>
                </li>
              );
            })}
            {(!returns || returns.length === 0) && <li className="px-5 py-8 text-center text-muted-foreground">No open returns.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
