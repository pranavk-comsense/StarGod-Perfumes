import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BanknoteIcon, RotateCcwIcon, TruckIcon } from "lucide-react";
import { getProductBySlug } from "@/lib/catalog/queries";
import { noteImageUrl } from "@/lib/catalog/notes";
import { formatDate } from "@/lib/orders/format";
import { RatingStars } from "@/components/store/rating-stars";
import { CONCENTRATION_LABEL } from "@/components/store/product-card";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductPurchase } from "@/components/store/product-purchase";
import { ReviewForm } from "@/components/store/review-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserId } from "@/lib/supabase/server";
import { isWishlisted } from "@/lib/store/actions";
import { productImageUrl } from "@/lib/images";
import { publicEnv } from "@/lib/env";
import { paiseToRupees } from "@/lib/money";
import type { ProductDetail } from "@/lib/catalog/queries";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return { title: "Not found" };
  return {
    title: `${product.name}: ${CONCENTRATION_LABEL[product.concentration]}`,
    description: product.tagline ?? product.description ?? undefined,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

async function ProductContent({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  return (
    <div className="container-page py-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        /{" "}
        <Link href={product.offer ? `/shop?category=${product.offer.slug}` : "/shop"} className="hover:text-foreground">
          {product.offer?.collection ?? "Shop"}
        </Link>{" "}
        / <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery images={product.images} name={product.name} />

        <div className="lg:py-4">
          <p className="eyebrow">{CONCENTRATION_LABEL[product.concentration]}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{product.name}</h1>
          {product.tagline && <p className="mt-2 text-muted-foreground">{product.tagline}</p>}
          {product.ratingCount > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <RatingStars value={product.ratingAvg} /> {product.ratingAvg.toFixed(1)} · {product.ratingCount}{" "}
              {product.ratingCount === 1 ? "review" : "reviews"}
            </a>
          )}

          {product.offer && (
            <Link
              href={`/shop?category=${product.offer.slug}`}
              className="mt-5 flex items-center justify-between gap-3 rounded-md border border-gold/40 bg-accent px-4 py-3 text-sm"
            >
              <span>
                <span className="font-semibold">{product.offer.label} free</span> · Add any 2 from the {product.offer.collection}; the second one is free.
              </span>
              <span className="shrink-0 underline underline-offset-4">Shop</span>
            </Link>
          )}
          <Suspense fallback={<Skeleton className="mt-6 h-64 w-full" />}>
            <PurchaseBlock product={product} />
          </Suspense>

          <ul className="mt-8 grid gap-3 border-y py-5 text-sm">
            <li className="flex items-center gap-3">
              <TruckIcon className="size-5 text-gold" strokeWidth={1.4} /> Free shipping above ₹999 · Dispatched in 24–48 hours
            </li>
            <li className="flex items-center gap-3">
              <BanknoteIcon className="size-5 text-gold" strokeWidth={1.4} /> Cash on Delivery available
            </li>
            <li className="flex items-center gap-3">
              <RotateCcwIcon className="size-5 text-gold" strokeWidth={1.4} /> Easy replacement for damaged or leaking bottles
            </li>
          </ul>

          {product.description && (
            <section className="mt-8">
              <h2 className="eyebrow font-sans text-foreground">Description</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{product.description}</p>
            </section>
          )}
        </div>
      </div>

      <NotesSection notes={product.notes} />

      <ProductJsonLd product={product} />
      <section id="reviews" className="mt-20 scroll-mt-28">
        <h2 className="text-3xl">Customer reviews</h2>
        <details className="mt-4 rounded-md border bg-card p-5 open:pb-6">
          <summary className="cursor-pointer text-sm font-medium">Write a review</summary>
          <div className="mt-4">
            <Suspense>
              <ReviewBlock productId={product.id} productSlug={product.slug} />
            </Suspense>
          </div>
        </details>
        {product.reviews.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No reviews yet. Be the first to review after your purchase.</p>
        ) : (
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {product.reviews.map((r) => (
              <li key={r.id} className="rounded-md border bg-card p-5">
                <div className="flex items-center justify-between">
                  <RatingStars value={r.rating} />
                  <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
                </div>
                {r.title && <p className="mt-3 font-medium">{r.title}</p>}
                {r.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
                <p className="mt-3 text-xs text-muted-foreground">
                  {r.author}
                  {r.isVerified && <span className="ml-2 text-success">✓ Verified buyer</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const TIERS = [
  { key: "top", label: "Top notes", hint: "The opening · first 15 minutes" },
  { key: "heart", label: "Heart notes", hint: "The character · 1 to 4 hours" },
  { key: "base", label: "Base notes", hint: "The drydown · lingers all day" },
] as const;

function NotesSection({ notes }: { notes: ProductDetail["notes"] }) {
  if (!TIERS.some((t) => notes[t.key].length)) return null;
  return (
    <section aria-labelledby="notes-heading" className="mt-16 rounded-2xl bg-accent/70 px-5 py-10 sm:px-10 lg:mt-20">
      <p className="eyebrow text-center">The composition</p>
      <h2 id="notes-heading" className="mt-2 text-center text-3xl sm:text-4xl">
        Fragrance notes
      </h2>
      <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-primary/15">
        {TIERS.filter((t) => notes[t.key].length).map((t) => (
          <div key={t.key} className="text-center md:px-6">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-[0.25em] text-primary-deep">{t.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t.hint}</p>
            <ul className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-6">
              {notes[t.key].map((name) => {
                const src = noteImageUrl(name);
                return (
                  <li key={name} className="w-20 sm:w-24">
                    <div className="mx-auto grid size-20 place-items-center sm:size-24 rounded-full bg-gradient-to-b from-primary/10 to-primary/25 shadow-sm ring-1 ring-primary/15">
                      {src ? (
                        <Image src={src} alt="" width={80} height={80} className="size-[3.75rem] object-contain sm:size-[4.5rem] drop-shadow-md" />
                      ) : (
                        <span className="font-heading text-2xl text-primary">{name[0]}</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-tight">{name}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

async function PurchaseBlock({ product }: { product: ProductDetail }) {
  const wishlisted = await isWishlisted(product.id);
  return <ProductPurchase productId={product.id} productSlug={product.slug} variants={product.variants} initiallyWishlisted={wishlisted} />;
}

async function ReviewBlock({ productId, productSlug }: { productId: string; productSlug: string }) {
  const userId = await getUserId();
  return <ReviewForm productId={productId} productSlug={productSlug} signedIn={!!userId} />;
}

function ProductJsonLd({ product }: { product: ProductDetail }) {
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const image = productImageUrl(product.images[0]?.path);
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.tagline ?? undefined,
    image: image.startsWith("/") ? `${site}${image}` : image,
    brand: { "@type": "Brand", name: "StarGod Perfumes" },
    sku: product.variants[0]?.id,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      name: v.label,
      price: paiseToRupees(v.price).toFixed(2),
      priceCurrency: "INR",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${site}/products/${product.slug}`,
    })),
    ...(product.ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: product.ratingAvg, reviewCount: product.ratingCount } }
      : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

function ProductSkeleton() {
  return (
    <div className="container-page grid gap-10 py-12 lg:grid-cols-2">
      <Skeleton className="aspect-[4/5]" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
