import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, PackageIcon, ShieldIcon, UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/dal";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/orders/format";
import { OrderStatusBadge } from "@/components/store/status-badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "My account" };

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <Tile href="/account/orders" icon={PackageIcon} title="Orders" text="Track, cancel or reorder" />
        <Tile href="/account/profile" icon={UserIcon} title="Profile" text={user.email ?? "Your details"} />
        <Tile href="/account/security" icon={ShieldIcon} title="Security" text="Password & sessions" />
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-sans text-base font-medium">Recent orders</h2>
          <Link href="/account/orders" className="text-sm text-muted-foreground hover:text-foreground">
            View all
          </Link>
        </div>
        {orders && orders.length > 0 ? (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.order_number}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 text-sm hover:bg-muted/50">
                <div>
                  <p className="font-medium">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p>
                </div>
                <OrderStatusBadge status={o.status} />
                <p className="font-medium">{formatINR(o.total)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">You haven&apos;t placed any orders yet.</p>
            <Link href="/shop" className={buttonVariants({ className: "mt-4" })}>
              Start shopping <ArrowRightIcon />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ href, icon: Icon, title, text }: { href: string; icon: typeof UserIcon; title: string; text: string }) {
  return (
    <Link href={href} className="group rounded-md border bg-card p-5 transition-colors hover:border-foreground/30">
      <Icon className="size-5 text-gold" strokeWidth={1.5} />
      <p className="mt-3 font-medium">{title}</p>
      <p className="truncate text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
