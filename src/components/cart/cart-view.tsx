"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Loader2Icon, MinusIcon, PlusIcon, ShoppingBagIcon, TagIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { getQuote } from "@/lib/cart/actions";
import type { Quote } from "@/lib/cart/types";
import { formatINR } from "@/lib/money";
import { ProductImage } from "@/components/store/product-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

export const COUPON_KEY = "sg_coupon";

export function readCoupon() {
  try {
    return sessionStorage.getItem(COUPON_KEY) ?? "";
  } catch {
    return "";
  }
}
function writeCoupon(code: string) {
  try {
    if (code) sessionStorage.setItem(COUPON_KEY, code);
    else sessionStorage.removeItem(COUPON_KEY);
  } catch {
    /* ignore */
  }
}

export function CartView() {
  const cart = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, startLoading] = useTransition();
  const [coupon, setCoupon] = useState("");
  const [couponInput, setCouponInput] = useState("");

  useEffect(() => {
    const saved = readCoupon();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore from sessionStorage after mount
    setCoupon(saved);
    setCouponInput(saved);
  }, []);

  useEffect(() => {
    if (!cart.items.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- empty cart has no quote
      setQuote(null);
      return;
    }
    const items = cart.items;
    startLoading(async () => {
      const q = await getQuote(items, coupon || undefined);
      setQuote(q);
    });
  }, [cart.items, coupon]);

  // Forget a coupon the server rejected.
  useEffect(() => {
    if (quote?.coupon_error && coupon) writeCoupon("");
  }, [quote, coupon]);

  if (!cart.ready && cart.items.length === 0) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShoppingBagIcon className="mx-auto size-10 text-muted-foreground" strokeWidth={1.2} />
        <h1 className="mt-4 text-4xl">Your bag is empty</h1>
        <p className="mt-2 text-sm text-muted-foreground">Buy 1 Get 1 free on our Silver & Golden collections.</p>
        <Link href="/shop" className={buttonVariants({ size: "lg", className: "mt-8" })}>
          Shop fragrances
        </Link>
      </div>
    );
  }

  const lines = quote?.lines ?? [];
  const hasIssues = lines.some((l) => l.issue);
  const toFree = quote?.free_shipping_threshold ? quote.free_shipping_threshold - (quote.subtotal - quote.offer_discount - quote.discount) : 0;
  const checkoutHref = `/checkout${coupon && !quote?.coupon_error ? `?coupon=${encodeURIComponent(coupon)}` : ""}`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="bag-heading">
        <h1 id="bag-heading" className="text-4xl">
          Your bag <span className="text-2xl text-muted-foreground">({cart.count})</span>
        </h1>
        {quote?.offers
          .filter((o) => o.add_one_more)
          .map((o) => (
            <Link key={o.collection} href={`/shop?category=${o.collection}`} className="mt-4 block rounded-md border border-gold/40 bg-accent px-4 py-3 text-sm">
              <b>Buy 1 Get 1:</b> add one more from the <b>{o.name}</b> and it&apos;s free →
            </Link>
          ))}
        {quote && toFree > 0 && quote.shipping_fee > 0 && (
          <p className="mt-4 rounded-md bg-accent px-4 py-3 text-sm">
            Add <b>{formatINR(toFree)}</b> more for <b>free shipping</b>.
          </p>
        )}
        <ul className="mt-6 divide-y border-y">
          {!quote && loading
            ? cart.items.map((i) => (
                <li key={i.variantId} className="py-5">
                  <Skeleton className="h-24" />
                </li>
              ))
            : lines.map((l) => (
                <li key={l.variant_id} className="flex gap-4 py-5">
                  <Link href={l.product_slug ? `/products/${l.product_slug}` : "#"} className="relative aspect-square w-20 shrink-0 overflow-hidden rounded bg-secondary sm:w-24">
                    <ProductImage path={l.image_path} alt={l.product_name ?? "Product"} sizes="96px" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={l.product_slug ? `/products/${l.product_slug}` : "#"} className="font-heading text-lg leading-tight hover:underline">
                          {l.product_name ?? "Unavailable item"}
                        </Link>
                        <p className="text-sm text-muted-foreground">{l.label}</p>
                      </div>
                      <p className="shrink-0 font-medium">{l.line_total != null ? formatINR(l.line_total) : "—"}</p>
                    </div>
                    {l.issue && (
                      <p className="mt-1 text-sm text-destructive">
                        {l.issue === "insufficient_stock"
                          ? l.stock
                            ? `Only ${l.stock} left. Reduce the quantity to continue.`
                            : "Sold out. Please remove it to continue."
                          : "No longer available. Please remove it."}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex h-9 items-center rounded-md border bg-card">
                        <button type="button" aria-label="Decrease quantity" className="flex h-full w-9 items-center justify-center" onClick={() => cart.setQty(l.variant_id, l.qty - 1)}>
                          <MinusIcon className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm tabular-nums">{l.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          className="flex h-full w-9 items-center justify-center disabled:opacity-40"
                          disabled={l.qty >= Math.min(10, l.stock ?? 10)}
                          onClick={() => cart.setQty(l.variant_id, l.qty + 1)}
                        >
                          <PlusIcon className="size-3.5" />
                        </button>
                      </div>
                      <button type="button" onClick={() => cart.remove(l.variant_id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive">
                        <Trash2Icon className="size-4" /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
        </ul>
        <Link href="/shop" className="mt-6 inline-block text-sm underline underline-offset-4">
          Continue shopping
        </Link>
      </section>

      <aside className="h-fit rounded-md border bg-card p-6 lg:sticky lg:top-32" aria-label="Order summary">
        <h2 className="font-sans text-base font-medium">Order summary</h2>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            const code = couponInput.trim().toUpperCase();
            setCoupon(code);
            writeCoupon(code);
          }}
        >
          <label htmlFor="coupon" className="text-sm text-muted-foreground">
            Coupon code
          </label>
          {quote?.coupon ? (
            <div className="mt-1.5 flex items-center justify-between rounded-md border border-success/40 bg-success/5 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <TagIcon className="size-4 text-success" /> <b>{quote.coupon.code}</b> applied
              </span>
              <button
                type="button"
                aria-label="Remove coupon"
                onClick={() => {
                  setCoupon("");
                  setCouponInput("");
                  writeCoupon("");
                }}
              >
                <XIcon className="size-4" />
              </button>
            </div>
          ) : (
            <div className="mt-1.5 flex gap-2">
              <input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                maxLength={30}
                placeholder="e.g. WELCOME10"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm uppercase outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" variant="outline" disabled={!couponInput.trim() || loading}>
                Apply
              </Button>
            </div>
          )}
          {quote?.coupon?.description && <p className="mt-1.5 text-xs text-muted-foreground">{quote.coupon.description}</p>}
          {quote?.coupon_error && coupon && <p className="mt-1.5 text-xs text-destructive">{quote.coupon_error}</p>}
        </form>

        <dl className={cn("mt-6 grid gap-2 text-sm", loading && "opacity-60")}>
          <Row label="Subtotal" value={quote ? formatINR(quote.subtotal) : "—"} />
          {quote && quote.mrp_total > quote.subtotal && <Row label="You save on MRP" value={formatINR(quote.mrp_total - quote.subtotal)} tone="success" />}
          {quote?.offers
            .filter((o) => o.amount > 0)
            .map((o) => (
              <Row key={o.collection} label={`Buy 1 Get 1 (${o.name.replace(" Collection", "")})`} value={`−${formatINR(o.amount)}`} tone="success" />
            ))}
          {quote && quote.discount > 0 && <Row label={`Coupon (${quote.coupon?.code})`} value={`−${formatINR(quote.discount)}`} tone="success" />}
          <Row label="Shipping" value={quote ? (quote.shipping_fee ? formatINR(quote.shipping_fee) : "Free") : "—"} />
          <div className="mt-2 flex justify-between border-t pt-4 text-base font-medium">
            <dt>Total</dt>
            <dd className="flex items-center gap-2">
              {loading && <Loader2Icon className="size-4 animate-spin" />}
              {quote ? formatINR(quote.total) : "—"}
            </dd>
          </div>
          <p className="text-xs text-muted-foreground">COD fee, if any, is added at checkout.</p>
        </dl>

        <Link
          href={checkoutHref}
          aria-disabled={hasIssues || !quote}
          className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full", (hasIssues || !quote) && "pointer-events-none opacity-50")}
        >
          Checkout
        </Link>
        {hasIssues && <p className="mt-2 text-center text-xs text-destructive">Fix the items above to continue.</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">Secure payment via UPI, cards & net banking, or Cash on Delivery</p>
      </aside>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={tone === "success" ? "text-success" : undefined}>{value}</dd>
    </div>
  );
}
