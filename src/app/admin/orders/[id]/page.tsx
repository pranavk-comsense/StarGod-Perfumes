import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AlertTriangleIcon, FileTextIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrderDetail, type ShippingAddress } from "@/lib/orders/queries";
import { actorLabel, formatDateTime, ORDER_STATUS_LABEL } from "@/lib/orders/format";
import { formatINR } from "@/lib/money";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { AddressBlock, OrderItems, OrderTotals, ShipmentTracking } from "@/components/orders/order-summary";
import { OrderActions } from "@/components/admin/order-actions";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const user = await requirePermission("orders.view");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const order = await getOrderDetail(supabase, { id });
  if (!order) notFound();

  const canRefund = can(user.role, "refunds.manage");
  const [{ data: customer }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", order.user_id).maybeSingle(),
    canRefund ? createAdminClient().from("payments").select("cf_payment_id, amount, status, method, created_at").eq("order_id", id).order("created_at") : Promise.resolve({ data: null }),
  ]);

  const refunded = order.refunds.filter((r) => r.status !== "failed").reduce((n, r) => n + r.amount, 0);
  const refundable = order.payment_status === "paid" || order.payment_status === "partially_refunded" ? order.total - refunded : 0;
  const active = order.shipments.find((s) => s.is_active);

  return (
    <>
      <Link href="/admin/orders" className="text-xs text-muted-foreground hover:text-foreground">
        ← Orders
      </Link>
      <div className="mb-6 mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(order.created_at)} · {order.payment_method === "cod" ? "Cash on Delivery" : "Prepaid"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <OrderStatusBadge status={order.status} className="text-sm" />
          {!["pending_payment", "payment_failed"].includes(order.status) && (
            <Link href={`/invoice/${order.order_number}`} target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <FileTextIcon /> Invoice
            </Link>
          )}
        </div>
      </div>

      {order.needs_refund && (
        <div className="mb-6 flex gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangleIcon className="size-4 shrink-0" />
          This order needs a refund (late payment, amount mismatch or cancellation).{" "}
          {canRefund ? "Issue it below." : "Ask an admin to issue it."}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid h-fit gap-6">
          <section className="rounded-md border bg-card p-5">
            <h2 className="mb-4 font-sans text-base font-medium">Actions</h2>
            <OrderActions
              orderId={order.id}
              status={order.status}
              paymentMethod={order.payment_method}
              paymentStatus={order.payment_status}
              activeShipmentId={active?.id ?? null}
              refundable={refundable}
              needsRefund={order.needs_refund}
              adminNote={order.admin_note}
              canRefund={canRefund}
            />
          </section>

          <section className="rounded-md border bg-card px-5">
            <h2 className="pt-5 font-sans text-base font-medium">Items</h2>
            <OrderItems order={order} linkProducts={false} />
          </section>

          {order.shipments.length > 0 && (
            <section className="rounded-md border bg-card p-5">
              <h2 className="mb-4 font-sans text-base font-medium">Shipment</h2>
              <ShipmentTracking order={order} />
            </section>
          )}

          <section className="rounded-md border bg-card p-5">
            <h2 className="mb-4 font-sans text-base font-medium">Timeline</h2>
            <ol className="grid gap-3 text-sm">
              {order.order_status_history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <span className="font-medium">{ORDER_STATUS_LABEL[h.to_status]}</span>
                    {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
                    <span className="text-xs text-muted-foreground"> · {actorLabel(h.actor)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="grid h-fit gap-6">
          <section className="rounded-md border bg-card p-5 text-sm">
            <h2 className="mb-3 font-sans text-base font-medium">Customer</h2>
            <p className="font-medium">{customer?.full_name ?? "—"}</p>
            <p className="text-muted-foreground">{customer?.email ?? order.contact_email}</p>
            {customer?.phone && <p className="text-muted-foreground">+91 {customer.phone}</p>}
          </section>
          <section className="rounded-md border bg-card p-5">
            <h2 className="mb-3 font-sans text-base font-medium">Ship to</h2>
            <AddressBlock address={order.shipping_address as unknown as ShippingAddress} />
          </section>
          <section className="rounded-md border bg-card p-5">
            <h2 className="mb-3 font-sans text-base font-medium">Payment</h2>
            <OrderTotals order={order} />
          </section>
          {payments && payments.length > 0 && (
            <section className="rounded-md border bg-card p-5 text-sm">
              <h2 className="mb-3 font-sans text-base font-medium">Payment attempts</h2>
              <ul className="grid gap-2">
                {payments.map((p) => (
                  <li key={p.cf_payment_id} className="flex justify-between gap-2">
                    <span>
                      {p.status} · {p.method || "—"}
                      <span className="block text-xs text-muted-foreground">{p.cf_payment_id}</span>
                    </span>
                    <span>{formatINR(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {order.refunds.length > 0 && (
            <section className="rounded-md border bg-card p-5 text-sm">
              <h2 className="mb-3 font-sans text-base font-medium">Refunds</h2>
              <ul className="grid gap-2">
                {order.refunds.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span>
                      {r.refund_id} · <span className="capitalize">{r.status}</span>
                      <span className="block text-xs text-muted-foreground">{r.reason}</span>
                    </span>
                    <span>{formatINR(r.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
