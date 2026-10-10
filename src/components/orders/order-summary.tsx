import Link from "next/link";
import { CheckIcon, ExternalLinkIcon, TruckIcon } from "lucide-react";
import { cn } from "cn";
import { formatINR } from "@/lib/money";
import { formatDateTime, ORDER_STEPS, PAYMENT_STATUS_LABEL } from "@/lib/orders/format";
import type { OrderDetail, ShippingAddress } from "@/lib/orders/queries";
import { ProductImage } from "@/components/store/product-image";

/** Shared order rendering for the customer order page and the admin order page. */
export function OrderProgress({ status }: { status: OrderDetail["status"] }) {
  const current = ORDER_STEPS.findIndex((s) => s.status === status);
  if (current === -1) return null;
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
      {ORDER_STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s.status} className="flex flex-col items-center gap-2 text-center text-xs">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-border")} />
              <span className={cn("flex size-7 items-center justify-center rounded-full border-2", done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                {done && <CheckIcon className="size-3.5" />}
              </span>
              <span className={cn("h-0.5 flex-1", i === ORDER_STEPS.length - 1 ? "bg-transparent" : i < current ? "bg-primary" : "bg-border")} />
            </div>
            <span className={done ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItems({ order, linkProducts = true }: { order: OrderDetail; linkProducts?: boolean }) {
  return (
    <ul className="divide-y">
      {order.order_items.map((i) => (
        <li key={i.id} className="flex gap-4 py-4">
          <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded bg-secondary">
            <ProductImage path={i.image_path} alt="" sizes="64px" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            {linkProducts ? (
              <Link href={`/products/${i.product_slug}`} className="font-medium hover:underline">
                {i.product_name}
              </Link>
            ) : (
              <p className="font-medium">{i.product_name}</p>
            )}
            <p className="text-muted-foreground">
              {i.variant_label} · Qty {i.qty} · {formatINR(i.unit_price)} each
            </p>
            <p className="text-xs text-muted-foreground">SKU {i.sku}</p>
          </div>
          <p className="text-sm font-medium">{formatINR(i.line_total)}</p>
        </li>
      ))}
    </ul>
  );
}

export function OrderTotals({ order }: { order: OrderDetail }) {
  const refunded = order.refunds.filter((r) => r.status === "success").reduce((n, r) => n + r.amount, 0);
  return (
    <dl className="grid gap-2 text-sm">
      <Row label="Subtotal" value={formatINR(order.subtotal)} />
      {order.offer_discount > 0 && <Row label="Buy 1 Get 1" value={`−${formatINR(order.offer_discount)}`} />}
      {order.discount > 0 && <Row label={`Discount${order.coupon_code ? ` (${order.coupon_code})` : ""}`} value={`−${formatINR(order.discount)}`} />}
      <Row label="Shipping" value={order.shipping_fee ? formatINR(order.shipping_fee) : "Free"} />
      {order.cod_fee > 0 && <Row label="COD fee" value={formatINR(order.cod_fee)} />}
      <div className="flex justify-between border-t pt-3 text-base font-medium">
        <dt>Total</dt>
        <dd>{formatINR(order.total)}</dd>
      </div>
      <Row label="GST included" value={formatINR(order.gst_amount)} />
      <Row label="Payment" value={`${order.payment_method === "cod" ? "Cash on Delivery" : "Online"} · ${PAYMENT_STATUS_LABEL[order.payment_status]}`} />
      {refunded > 0 && <Row label="Refunded" value={formatINR(refunded)} />}
    </dl>
  );
}

export function AddressBlock({ address }: { address: ShippingAddress }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{address.name}</span>
      <br />
      {address.line1}
      {address.line2 && (
        <>
          , {address.line2}
        </>
      )}
      {address.landmark && (
        <>
          <br />
          Near {address.landmark}
        </>
      )}
      <br />
      {address.city}, {address.state} {address.pincode}
      {address.phone && (
        <>
          <br />
          +91 {address.phone}
        </>
      )}
    </address>
  );
}

export function ShipmentTracking({ order }: { order: OrderDetail }) {
  const shipment = order.shipments.find((s) => s.is_active) ?? order.shipments[0];
  if (!shipment) return null;
  return (
    <div className="grid gap-3 text-sm">
      <p className="flex flex-wrap items-center gap-2">
        <TruckIcon className="size-4 text-gold" />
        <span className="font-medium">{shipment.courier_name ?? "Courier"}</span>
        {shipment.awb && <span className="text-muted-foreground">AWB {shipment.awb}</span>}
        {shipment.tracking_url && (
          <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
            Track on courier site <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </p>
      {shipment.shipment_events.length > 0 && (
        <ol className="grid gap-3 border-l pl-4">
          {shipment.shipment_events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
              <p className="font-medium capitalize">{e.description ?? e.status.replace(/_/g, " ")}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.occurred_at)}
                {e.location ? ` · ${e.location}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
