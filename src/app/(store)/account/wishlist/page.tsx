import type { Metadata } from "next";
import Link from "next/link";
import { HeartIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/catalog/queries";
import { ProductCard } from "@/components/store/product-card";
import { WishlistRemove } from "@/components/account/wishlist-remove";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Wishlist" };

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const supabase = await createClient();
  const { data } = await supabase.from("wishlist_items").select("product_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  const ids = (data ?? []).map((w) => w.product_id);
  const all = ids.length ? await getProducts() : [];
  const products = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);

  if (products.length === 0) {
    return (
      <div className="rounded-md border bg-card px-6 py-16 text-center">
        <HeartIcon className="mx-auto size-10 text-muted-foreground" strokeWidth={1.2} />
        <h2 className="mt-4 text-2xl">Your wishlist is empty</h2>
        <p className="mt-2 text-sm text-muted-foreground">Tap the heart on any fragrance to save it for later.</p>
        <Link href="/shop" className={buttonVariants({ className: "mt-6" })}>
          Explore fragrances
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">
      {products.map((p) => (
        <div key={p.id} className="relative">
          <ProductCard product={p} />
          <WishlistRemove productId={p.id} />
        </div>
      ))}
    </div>
  );
}
