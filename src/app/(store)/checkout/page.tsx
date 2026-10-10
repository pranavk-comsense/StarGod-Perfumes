import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { CheckoutWaiting } from "@/components/checkout/checkout-waiting";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

// Auth-gated and per-user: render on the server after the session check.
export const instant = false;

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const user = await requireUser("/checkout");
  const coupon = (await searchParams).coupon;
  const supabase = await createClient();
  const [{ data: cart }, { data: addresses }] = await Promise.all([
    supabase.from("cart_items").select("variant_id, qty").eq("user_id", user.id).order("updated_at"),
    supabase
      .from("addresses")
      .select("id, name, phone, line1, line2, landmark, city, state, pincode, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at"),
  ]);
  if (!cart?.length) return <CheckoutWaiting />;

  return (
    <div className="container-page py-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/cart" className="hover:text-foreground">
          Bag
        </Link>{" "}
        / <span className="text-foreground">Checkout</span>
      </nav>
      <h1 className="mb-8 mt-2 text-4xl">Checkout</h1>
      <CheckoutView
        items={cart.map((c) => ({ variantId: c.variant_id, qty: c.qty }))}
        addresses={addresses ?? []}
        coupon={typeof coupon === "string" ? coupon.slice(0, 30) : undefined}
        onlineEnabled={isCashfreeConfigured()}
        defaultName={user.fullName ?? ""}
        defaultPhone={user.phone ?? ""}
      />
    </div>
  );
}
