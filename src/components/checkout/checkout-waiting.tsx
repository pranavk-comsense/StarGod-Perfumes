"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";

/**
 * Rendered when the saved cart is empty on the server. Right after signing in,
 * the guest cart is still being merged on the client, so wait for that, then
 * reload checkout; if the cart really is empty, go back to the bag.
 */
export function CheckoutWaiting() {
  const { ready, signedIn, items } = useCart();
  const router = useRouter();
  const done = useRef(false);

  // Checkout is only reachable signed in, so wait for the signed-in (merged) cart.
  useEffect(() => {
    if (!ready || !signedIn || done.current) return;
    done.current = true;
    if (items.length > 0) router.refresh();
    else router.replace("/cart");
  }, [ready, signedIn, items, router]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        router.replace("/cart");
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" /> Loading your bag…
    </div>
  );
}
