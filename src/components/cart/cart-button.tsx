"use client";

import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";

export function CartButton() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={count ? `Shopping bag, ${count} ${count === 1 ? "item" : "items"}` : "Shopping bag"}
      className="relative flex size-10 items-center justify-center rounded-md hover:bg-white/10"
    >
      <ShoppingBagIcon className="size-5" strokeWidth={1.5} />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold leading-4.5 text-primary">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
