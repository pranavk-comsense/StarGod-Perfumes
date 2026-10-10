"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HeartIcon, MinusIcon, PlusIcon, MapPinIcon } from "lucide-react";
import { cn } from "cn";
import { Price } from "@/components/store/price";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-provider";
import { checkPincode, toggleWishlist } from "@/lib/store/actions";
import { MAX_QTY } from "@/lib/cart/types";

type Variant = { id: string; label: string; price: number; mrp: number; stock: number };

export function ProductPurchase({
  productId,
  productSlug,
  variants,
  initiallyWishlisted,
}: {
  productId: string;
  productSlug: string;
  variants: Variant[];
  initiallyWishlisted: boolean;
}) {
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0];
  const [selectedId, setSelectedId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [wishlisted, setWishlisted] = useState(initiallyWishlisted);
  const [pending, startTransition] = useTransition();
  const cart = useCart();
  const router = useRouter();

  const selected = variants.find((v) => v.id === selectedId) ?? firstAvailable;
  if (!selected) return null;
  const inCart = cart.items.find((i) => i.variantId === selected.id)?.qty ?? 0;
  const maxQty = Math.max(0, Math.min(MAX_QTY, selected.stock) - inCart);

  function addToBag(buyNow = false) {
    if (maxQty <= 0) {
      toast.error(selected.stock <= 0 ? "This size is sold out." : "You already have the maximum quantity in your bag.");
      return;
    }
    cart.add(selected.id, Math.min(qty, maxQty));
    if (buyNow) {
      router.push("/cart");
      return;
    }
    toast.success("Added to your bag", {
      description: `${selected.label} × ${Math.min(qty, maxQty)}`,
      action: { label: "View bag", onClick: () => router.push("/cart") },
    });
    setQty(1);
  }

  function onWishlist() {
    startTransition(async () => {
      const res = await toggleWishlist(productId);
      if (res.signedOut) {
        router.push(`/login?next=${encodeURIComponent(`/products/${productSlug}`)}`);
        return;
      }
      if (res.ok) {
        setWishlisted(!!res.saved);
        toast.success(res.saved ? "Saved to your wishlist" : "Removed from your wishlist");
      }
    });
  }

  return (
    <div className="mt-6">
      <Price price={selected.price} mrp={selected.mrp} size="lg" />
      <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

      <fieldset className="mt-6">
        <legend className="eyebrow mb-3 font-sans text-foreground">Size</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setSelectedId(v.id);
                setQty(1);
              }}
              aria-pressed={v.id === selected.id}
              className={cn(
                "min-w-24 rounded-md border px-4 py-2.5 text-sm transition-colors",
                v.id === selected.id ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-foreground/40",
                v.stock <= 0 && "text-muted-foreground line-through decoration-1",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </fieldset>

      {selected.stock > 0 && selected.stock <= 5 && <p className="mt-3 text-sm font-medium text-amber-700">Only {selected.stock} left in stock</p>}

      <div className="mt-6 flex gap-3">
        <div className="flex h-12 items-center rounded-md border bg-card" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-full w-10 items-center justify-center disabled:opacity-40" disabled={qty <= 1}>
            <MinusIcon className="size-4" />
          </button>
          <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQty((q) => Math.min(Math.max(1, maxQty), q + 1))}
            className="flex h-full w-10 items-center justify-center disabled:opacity-40"
            disabled={qty >= maxQty}
          >
            <PlusIcon className="size-4" />
          </button>
        </div>
        <Button size="lg" className="flex-1" disabled={selected.stock <= 0} onClick={() => addToBag()}>
          {selected.stock > 0 ? "Add to bag" : "Sold out"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="px-4"
          aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
          aria-pressed={wishlisted}
          disabled={pending}
          onClick={onWishlist}
        >
          <HeartIcon className={cn("size-5", wishlisted && "fill-destructive text-destructive")} />
        </Button>
      </div>
      {selected.stock > 0 && (
        <Button size="lg" variant="outline" className="mt-3 w-full" onClick={() => addToBag(true)}>
          Buy now
        </Button>
      )}
      {inCart > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {inCart} in your bag ·{" "}
          <Link href="/cart" className="underline underline-offset-2">
            View bag
          </Link>
        </p>
      )}

      <PincodeCheck />
    </div>
  );
}

function PincodeCheck() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="mt-6 rounded-md border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const pin = String(new FormData(e.currentTarget).get("pincode") ?? "");
        startTransition(async () => {
          const res = await checkPincode(pin);
          if (!res.ok) return setMessage({ ok: false, text: res.message });
          const r = res.result;
          if (!r.serviceable) return setMessage({ ok: false, text: `Sorry, we don't deliver to ${r.pincode} yet.` });
          setMessage({
            ok: true,
            text: `${r.confirmed ? "Delivery" : "Estimated delivery"} in ${r.etaDays[0]}–${r.etaDays[1]} days to ${r.pincode}${r.codAvailable ? " · COD available" : ""}`,
          });
        });
      }}
    >
      <label htmlFor="pincode" className="flex items-center gap-2 text-sm font-medium">
        <MapPinIcon className="size-4 text-gold" /> Check delivery
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="pincode"
          name="pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          pattern="[1-9][0-9]{5}"
          placeholder="Enter pincode"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Checking…" : "Check"}
        </Button>
      </div>
      {message && <p className={cn("mt-2 text-sm", message.ok ? "text-success" : "text-destructive")}>{message.text}</p>}
    </form>
  );
}
