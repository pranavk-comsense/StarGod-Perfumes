"use client";

import { useTransition } from "react";
import { XIcon } from "lucide-react";
import { removeFromWishlist } from "@/lib/account/actions";

export function WishlistRemove({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Remove from wishlist"
      disabled={pending}
      onClick={() => startTransition(async () => void (await removeFromWishlist(productId)))}
      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background"
    >
      <XIcon className="size-4" />
    </button>
  );
}
