"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BanknoteIcon, CreditCardIcon, Loader2Icon, LockIcon, MapPinIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { getQuote } from "@/lib/cart/actions";
import { checkPincode } from "@/lib/store/actions";
import { placeOrder } from "@/lib/checkout/actions";
import type { CartItem, Quote } from "@/lib/cart/types";
import { formatAddress, type Address } from "@/lib/validation/address";
import { formatINR } from "@/lib/money";
import { AddressForm } from "@/components/account/address-form";
import { ProductImage } from "@/components/store/product-image";
import { FormAlert } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { openCashfreeCheckout } from "@/components/checkout/open-cashfree";

export function CheckoutView({
  items,
  addresses,
  coupon,
  onlineEnabled,
  defaultName,
  defaultPhone,
}: {
  items: CartItem[];
  addresses: Address[];
  coupon?: string;
  onlineEnabled: boolean;
  defaultName: string;
  defaultPhone: string;
}) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? "");
  const [addingAddress, setAddingAddress] = useState(addresses.length === 0);
  const [method, setMethod] = useState<"prepaid" | "cod">(onlineEnabled ? "prepaid" : "cod");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, startQuote] = useTransition();
  const [placing, startPlacing] = useTransition();
  const [error, setError] = useState<string>();
  // One key per checkout visit: retries of "Place order" never create a second order.
  const checkoutKey = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    startQuote(async () => setQuote(await getQuote(items, coupon, method)));
  }, [items, coupon, method]);

  // Courier coverage for the chosen address (only a confirmed "no" blocks checkout).
  const pincode = addresses.find((a) => a.id === addressId)?.pincode ?? "";
  const [delivery, setDelivery] = useState<{ pincode: string; serviceable: boolean; codAvailable: boolean } | null>(null);
  useEffect(() => {
    if (!pincode) return;
    let stale = false;
    checkPincode(pincode).then((r) => {
      if (stale || !r.ok) return;
      const d = { pincode, serviceable: !r.result.confirmed || r.result.serviceable, codAvailable: !r.result.confirmed || r.result.codAvailable };
      setDelivery(d);
      if (d.serviceable && !d.codAvailable && onlineEnabled) setMethod((m) => (m === "cod" ? "prepaid" : m));
    });
    return () => {
      stale = true;
    };
  }, [pincode, onlineEnabled]);
  const current = delivery?.pincode === pincode ? delivery : null;
  const undeliverable = current ? !current.serviceable : false;
  const codNoCourier = current ? current.serviceable && !current.codAvailable : false;

  const codBlocked = (quote ? !quote.cod_available : false) || codNoCourier;
  const issues = quote?.errors.filter((e) => e.code !== "COD_UNAVAILABLE") ?? [];

  function submit() {
    setError(undefined);
    if (!addressId) return setError("Please add a delivery address.");
    startPlacing(async () => {
      const res = await placeOrder({ checkoutKey, addressId, paymentMethod: method, couponCode: quote?.coupon?.code });
      if (!res.ok) return setError(res.message);
      if (res.kind === "cod") {
        router.push(res.redirectTo);
        return;
      }
      try {
        await openCashfreeCheckout(res.paymentSessionId, res.mode);
      } catch {
        router.push(`/checkout/return?order=${encodeURIComponent(res.orderNumber)}`);
      }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
      <div className="grid gap-8">
        {/* 1. Address */}
        <section aria-labelledby="addr-h" className="rounded-md border bg-card p-5 sm:p-6">
          <h2 id="addr-h" className="flex items-center gap-2 font-sans text-base font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span> Delivery address
          </h2>
          {addresses.length > 0 && (
            <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Saved addresses">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn("flex cursor-pointer gap-3 rounded-md border p-4 text-sm", addressId === a.id ? "border-primary ring-1 ring-primary" : "hover:border-foreground/30")}
                >
                  <input type="radio" name="address" value={a.id} checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-[var(--primary)]" />
                  <span>
                    <span className="font-medium">{a.name}</span> · +91 {a.phone}
                    <span className="mt-1 block text-muted-foreground">{formatAddress(a)}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {undeliverable && !addingAddress && (
            <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Sorry, we don&apos;t deliver to {pincode} yet. Please choose or add a different address.
            </p>
          )}
          {addingAddress ? (
            <div className="mt-5">
              <AddressForm
                defaultName={defaultName}
                defaultPhone={defaultPhone}
                submitLabel="Save and deliver here"
                onSaved={(id) => {
                  setAddressId(id);
                  setAddingAddress(false);
                  router.refresh();
                }}
              />
              {addresses.length > 0 && (
                <Button variant="ghost" className="mt-2" onClick={() => setAddingAddress(false)}>
                  Cancel
                </Button>
              )}
            </div>
          ) : (
            <Button variant="outline" className="mt-4" onClick={() => setAddingAddress(true)}>
              <PlusIcon /> Add a new address
            </Button>
          )}
        </section>

        {/* 2. Payment */}
        <section aria-labelledby="pay-h" className="rounded-md border bg-card p-5 sm:p-6">
          <h2 id="pay-h" className="flex items-center gap-2 font-sans text-base font-medium">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span> Payment
          </h2>
          <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Payment method">
            <PayOption
              checked={method === "prepaid"}
              disabled={!onlineEnabled}
              onSelect={() => setMethod("prepaid")}
              icon={<CreditCardIcon className="size-5" />}
              title="Pay online"
              text={onlineEnabled ? "UPI, cards, net banking & wallets via Cashfree" : "Online payment is coming soon"}
            />
            <PayOption
              checked={method === "cod"}
              disabled={(codBlocked && method !== "cod") || codNoCourier}
              onSelect={() => setMethod("cod")}
              icon={<BanknoteIcon className="size-5" />}
              title="Cash on Delivery"
              text={codNoCourier ? `Not available for ${pincode}` : codBlocked ? (quote?.cod_unavailable_reason ?? "Not available") : "Pay in cash or UPI when your order arrives. A small COD fee applies."}
            />
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="h-fit rounded-md border bg-card p-6 lg:sticky lg:top-32" aria-label="Order summary">
        <h2 className="font-sans text-base font-medium">Order summary</h2>
        <ul className="mt-4 grid gap-4">
          {(quote?.lines ?? []).map((l) => (
            <li key={l.variant_id} className="flex gap-3 text-sm">
              <div className="relative aspect-square w-14 shrink-0 overflow-hidden rounded bg-secondary">
                <ProductImage path={l.image_path} alt="" sizes="56px" />
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{l.qty}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.product_name}</p>
                <p className="text-muted-foreground">{l.label}</p>
                {l.issue && <p className="text-xs text-destructive">Not available in this quantity</p>}
              </div>
              <p>{l.line_total != null ? formatINR(l.line_total) : "—"}</p>
            </li>
          ))}
        </ul>
        <dl className={cn("mt-6 grid gap-2 border-t pt-4 text-sm", quoting && "opacity-60")}>
          <Row label="Subtotal" value={quote ? formatINR(quote.subtotal) : "—"} />
          {quote && quote.offer_discount > 0 && <Row label="Buy 1 Get 1" value={`−${formatINR(quote.offer_discount)}`} success />}
          {quote && quote.discount > 0 && <Row label={`Coupon (${quote.coupon?.code})`} value={`−${formatINR(quote.discount)}`} success />}
          <Row label="Shipping" value={quote ? (quote.shipping_fee ? formatINR(quote.shipping_fee) : "Free") : "—"} />
          {quote && quote.cod_fee > 0 && <Row label="COD fee" value={formatINR(quote.cod_fee)} />}
          <div className="mt-2 flex justify-between border-t pt-4 text-base font-medium">
            <dt>Total</dt>
            <dd className="flex items-center gap-2">
              {quoting && <Loader2Icon className="size-4 animate-spin" />}
              {quote ? formatINR(quote.total) : "—"}
            </dd>
          </div>
        </dl>
        {coupon && quote?.coupon_error && <p className="mt-3 text-xs text-destructive">Coupon {coupon}: {quote.coupon_error}</p>}

        <div className="mt-5">
          <FormAlert message={error ?? (issues.length ? "Some items in your bag are no longer available in that quantity." : undefined)} />
        </div>
        <Button size="lg" className="mt-4 w-full" disabled={placing || quoting || !quote || issues.length > 0 || !addressId || addingAddress || undeliverable || (method === "cod" && codNoCourier)} onClick={submit}>
          {placing ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
          {placing ? "Placing order…" : method === "cod" ? "Place order" : `Pay ${quote ? formatINR(quote.total) : ""}`}
        </Button>
        {issues.length > 0 && (
          <Link href="/cart" className="mt-3 block text-center text-sm underline underline-offset-4">
            Review your bag
          </Link>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <MapPinIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>
            By placing this order you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/returns-refunds" className="underline">
              Returns policy
            </Link>
            .
          </span>
        </p>
      </aside>
    </div>
  );
}

function PayOption({
  checked,
  disabled,
  onSelect,
  icon,
  title,
  text,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <label
      className={cn(
        "flex gap-3 rounded-md border p-4 text-sm",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        checked ? "border-primary ring-1 ring-primary" : !disabled && "hover:border-foreground/30",
      )}
    >
      <input type="radio" name="payment" checked={checked} disabled={disabled} onChange={onSelect} className="mt-1 accent-[var(--primary)]" />
      <span className="mt-0.5 text-gold">{icon}</span>
      <span>
        <span className="font-medium">{title}</span>
        <span className="mt-0.5 block text-muted-foreground">{text}</span>
      </span>
    </label>
  );
}

function Row({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={success ? "text-success" : undefined}>{value}</dd>
    </div>
  );
}
