import type { Metadata } from "next";
import Link from "next/link";
import { PackageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";
import { formatINR } from "@/lib/money";
import { formatDate, PAYMENT_STATUS_LABEL } from "@/lib/orders/format";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My orders" };

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, total, created_at, order_items(product_name, variant_label, qty)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-md border bg-card px-6 py-16 text-center">
        <PackageIcon className="mx-auto size-10 text-muted-foreground" strokeWidth={1.2} />
        <h2 className="mt-4 text-2xl">No orders yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">When you place an order, you&apos;ll be able to track it here.</p>
        <Link href="/shop" className={buttonVariants({ className: "mt-6" })}>
          Explore fragrances
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.order_number}`} className="block rounded-md border bg-card p-5 transition-colors hover:border-foreground/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{o.order_number}</p>
              <p className="text-xs text-muted-foreground">
                Placed {formatDate(o.created_at)} · {o.payment_method === "cod" ? "Cash on Delivery" : "Prepaid"} ·{" "}
                {PAYMENT_STATUS_LABEL[o.payment_status]}
              </p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {o.order_items.map((i) => `${i.product_name} (${i.variant_label}) × ${i.qty}`).join(", ")}
          </p>
          <p className="mt-3 text-sm font-medium">{formatINR(o.total)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
