import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleCheckIcon, FileTextIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { customerCanCancel, getOrderDetail, type ShippingAddress } from "@/lib/orders/queries";
import { formatDateTime, ORDER_STATUS_LABEL } from "@/lib/orders/format";
import { formatINR } from "@/lib/money";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { AddressBlock, OrderItems, OrderProgress, OrderTotals, ShipmentTracking } from "@/components/orders/order-summary";
import { CancelOrder } from "@/components/orders/cancel-order";
import { RetryPaymentButton } from "@/components/checkout/retry-payment";
import { CartRefresh } from "@/components/cart/cart-provider";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params, searchParams }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  const user = await requireUser(`/account/orders/${number}`);
  const placed = (await searchParams).placed === "1";
  const supabase = await createClient();
  const order = await getOrderDetail(supabase, { orderNumber: number });
  if (!order || order.user_id !== user.id) notFound();

  const pendingRefunds = order.refunds.filter((r) => r.status === "pending");
  const canPayAgain = order.status === "pending_payment" && order.reserved_until && new Date(order.reserved_until) > new Date();

  return (
    <div className="grid gap-6">
      {placed && <CartRefresh />}
      {placed && order.status !== "pending_payment" && (
        <div className="flex gap-3 rounded-md border border-success/30 bg-success/5 p-5">
          <CircleCheckIcon className="size-6 shrink-0 text-success" />
          <div>
            <p className="font-medium">Thank you! Your order is confirmed.</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ve emailed the details to {order.contact_email ?? "you"}. You&apos;ll get tracking info as soon as it ships.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/account/orders" className="text-xs text-muted-foreground hover:text-foreground">
            ← All orders
          </Link>
          <h2 className="mt-1 text-3xl">Order {order.order_number}</h2>
          <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.created_at)}</p>
        </div>
        <OrderStatusBadge status={order.status} className="text-sm" />
      </div>

      {order.status === "pending_payment" && (
        <div className="grid gap-3 rounded-md border border-amber-300 bg-amber-50 p-5 text-sm">
          <p>This order is waiting for payment. Unpaid orders are released automatically after 30 minutes.</p>
          {canPayAgain && (
            <div>
              <RetryPaymentButton orderNumber={order.order_number} />
            </div>
          )}
        </div>
      )}

      {["confirmed", "processing", "shipped", "delivered"].includes(order.status) && (
        <section className="rounded-md border bg-card p-5 sm:p-6">
          <OrderProgress status={order.status} />
        </section>
      )}

      {order.shipments.length > 0 && (
        <section className="rounded-md border bg-card p-5 sm:p-6">
          <h3 className="mb-4 font-sans text-base font-medium">Tracking</h3>
          <ShipmentTracking order={order} />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-md border bg-card px-5 sm:px-6">
          <h3 className="pt-5 font-sans text-base font-medium">Items</h3>
          <OrderItems order={order} />
        </section>
        <div className="grid h-fit gap-6">
          <section className="rounded-md border bg-card p-5">
            <h3 className="mb-3 font-sans text-base font-medium">Delivery address</h3>
            <AddressBlock address={order.shipping_address as unknown as ShippingAddress} />
          </section>
          <section className="rounded-md border bg-card p-5">
            <h3 className="mb-3 font-sans text-base font-medium">Payment summary</h3>
            <OrderTotals order={order} />
            {pendingRefunds.length > 0 && (
              <p className="mt-3 rounded bg-accent p-2 text-xs">Refund of {formatINR(pendingRefunds.reduce((n, r) => n + r.amount, 0))} is being processed.</p>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-md border bg-card p-5 sm:p-6">
        <h3 className="mb-4 font-sans text-base font-medium">History</h3>
        <ol className="grid gap-3 text-sm">
          {order.order_status_history.map((h) => (
            <li key={h.id} className="flex flex-wrap justify-between gap-2">
              <span>
                <span className="font-medium">{ORDER_STATUS_LABEL[h.to_status]}</span>
                {h.note && <span className="text-muted-foreground"> · {h.note}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap gap-3">
        {order.status !== "pending_payment" && order.status !== "payment_failed" && (
          <Link href={`/invoice/${order.order_number}`} target="_blank" className={buttonVariants({ variant: "outline" })}>
            <FileTextIcon /> Invoice
          </Link>
        )}
        {customerCanCancel(order) && <CancelOrder orderNumber={order.order_number} prepaid={order.payment_method === "prepaid" && order.payment_status === "paid"} />}
        <Link href="/contact" className={buttonVariants({ variant: "ghost" })}>
          Need help?
        </Link>
      </div>
      {order.status === "delivered" && (
        <p className="text-sm text-muted-foreground">Enjoying your fragrance? A quick review on the product page helps other shoppers.</p>
      )}
    </div>
  );
}
