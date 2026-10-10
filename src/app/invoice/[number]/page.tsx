import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { isStaffRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { getOrderDetail, type ShippingAddress } from "@/lib/orders/queries";
import { formatDate } from "@/lib/orders/format";
import { formatINR } from "@/lib/money";
import { PrintButton } from "@/components/orders/print-button";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };
export const instant = false;

/** Order invoice. Print / "Save as PDF" from the browser. */
export default async function InvoicePage({ params }: PageProps<"/invoice/[number]">) {
  const { number } = await params;
  const user = await requireUser(`/invoice/${number}`);
  const supabase = await createClient();
  const order = await getOrderDetail(supabase, { orderNumber: number });
  if (!order || (order.user_id !== user.id && !isStaffRole(user.role))) notFound();
  if (order.status === "pending_payment" || order.status === "payment_failed") notFound();

  const store = (await getSettings()).store;
  const addr = order.shipping_address as unknown as ShippingAddress;

  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-6 text-[13px] text-black sm:p-10 print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <header className="flex flex-wrap justify-between gap-6 border-b pb-6">
        <div>
          <p className="font-brand text-2xl font-extrabold text-primary">StarGod</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold">Premium Perfumes</p>
          <p className="mt-3">{store.legal_name ?? store.name}</p>
          <p className="max-w-xs text-neutral-600">{store.address ?? "[Registered address: add in Admin → Settings]"}</p>
        </div>
        <div className="text-right">
          <h1 className="font-sans text-lg font-semibold">INVOICE</h1>
          <p>Invoice no: INV-{order.order_number.replace(/^SG-/, "")}</p>
          <p>Order no: {order.order_number}</p>
          <p>Date: {formatDate(order.paid_at ?? order.created_at)}</p>
          <p>Payment: {order.payment_method === "cod" ? "Cash on Delivery" : "Prepaid (online)"}</p>
        </div>
      </header>

      <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Bill / ship to</p>
          <p className="font-medium">{addr.name}</p>
          <p>
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ""}
          </p>
          <p>
            {addr.city}, {addr.state} {addr.pincode}
          </p>
        </div>
      </section>

      <table className="mt-6 w-full border-collapse">
        <thead>
          <tr className="border-b text-left text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2 pr-2 font-medium">Item</th>
            <th className="py-2 pr-2 text-right font-medium">Qty</th>
            <th className="py-2 pr-2 text-right font-medium">Price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.order_items.map((l) => (
            <tr key={l.id} className="border-b align-top">
              <td className="py-2 pr-2">
                {l.product_name} ({l.variant_label})<span className="block text-[11px] text-neutral-500">SKU {l.sku}</span>
              </td>
              <td className="py-2 pr-2 text-right">{l.qty}</td>
              <td className="py-2 pr-2 text-right">{formatINR(l.unit_price)}</td>
              <td className="py-2 text-right">{formatINR(l.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto mt-6 grid max-w-xs gap-1.5">
        <Row label="Subtotal" value={formatINR(order.subtotal)} />
        {order.offer_discount > 0 && <Row label="Buy 1 Get 1 offer" value={`−${formatINR(order.offer_discount)}`} />}
        {order.discount > 0 && <Row label={order.coupon_code ? `Coupon (${order.coupon_code})` : "Discount"} value={`−${formatINR(order.discount)}`} />}
        {order.shipping_fee > 0 && <Row label="Shipping" value={formatINR(order.shipping_fee)} />}
        {order.cod_fee > 0 && <Row label="COD fee" value={formatINR(order.cod_fee)} />}
        <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Grand total</dt>
          <dd>{formatINR(order.total)}</dd>
        </div>
      </dl>

      <footer className="mt-10 border-t pt-4 text-[11px] text-neutral-500">
        <p>This is a computer-generated invoice and does not require a signature.</p>
        <p className="mt-1">Questions: {store.support_email}</p>
      </footer>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-600">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
