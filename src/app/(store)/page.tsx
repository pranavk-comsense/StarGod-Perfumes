import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRightIcon, BanknoteIcon, RotateCcwIcon, ShieldCheckIcon, TruckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/store/product-card";
import { VisitStore } from "@/components/store/visit-store";
import { RatingStars } from "@/components/store/rating-stars";
import { getCollectionProducts, getLatestReviews } from "@/lib/catalog/queries";
import { categories, fragranceFamilies } from "@/lib/site";
import { cn } from "cn";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />

      <section className="container-page mt-20" aria-labelledby="cat-heading">
        <SectionHeading eyebrow="Find your scent" title="Shop by category" id="cat-heading" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c, i) => (
            <Link
              key={c.slug}
              href={`/shop?category=${c.slug}`}
              className={cn(
                "group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-md p-4",
                i === 4 && "col-span-2 aspect-[8/5] sm:col-span-1 sm:aspect-[4/5]",
              )}
            >
              <Image
                src={CATEGORY_IMAGES[c.slug]}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 1024px) 20vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="relative text-white">
                <p className="font-heading text-2xl">{c.label}</p>
                <p className="text-xs text-white/80">{c.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <OfferBanner />

      <section className="container-page mt-20" aria-labelledby="best-heading">
        <SectionHeading eyebrow="Most loved" title="Bestsellers" id="best-heading" href="/shop?sort=rating" />
        <Suspense fallback={<ProductGridSkeleton />}>
          <CollectionGrid slug="bestsellers" />
        </Suspense>
      </section>

      <BrandStory />

      <section className="container-page mt-20" aria-labelledby="family-heading">
        <SectionHeading eyebrow="Explore by mood" title="Fragrance families" id="family-heading" />
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {fragranceFamilies.map((f) => (
            <Link
              key={f}
              href={`/shop?family=${f.toLowerCase()}`}
              className="rounded-full border bg-card px-5 py-2.5 text-sm transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
            >
              {f}
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-20" aria-labelledby="new-heading">
        <SectionHeading eyebrow="Just landed" title="New arrivals" id="new-heading" href="/shop?sort=newest" />
        <Suspense fallback={<ProductGridSkeleton />}>
          <CollectionGrid slug="new-arrivals" />
        </Suspense>
      </section>


      <Suspense>
        <Reviews />
      </Suspense>

      <VisitStore className="mt-20" />
    </>
  );
}

const CATEGORY_IMAGES: Record<string, string> = {
  men: "/images/products/honest-liar.svg",
  women: "/images/products/quick-storm.svg",
  unisex: "/images/products/rogue-alpha.svg",
  silver: "/images/products/potion-trail.svg",
  golden: "/images/products/quick-deception.svg",
};

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-primary-deep text-white">
      {/* layered brand-purple light */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_90%_at_72%_45%,#c27ad4_0%,#a357b7_35%,#612a6f_75%,#3f1849_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_110%,rgb(255_255_255/0.12),transparent_40%)]" />

      <div className="container-page grid items-center gap-6 pb-20 pt-10 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-14 lg:gap-10">
        <div className="relative z-10 max-w-xl text-center md:text-left">
          <p className="flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/75 md:justify-start">
            <span className="h-px w-8 bg-white/50" /> StarGod Premium Perfumes
          </p>
          <h1 className="mt-6 font-heading font-normal leading-[1.02] tracking-tight">
            <span className="block text-4xl italic text-lilac sm:text-5xl lg:text-6xl">24-Hour</span>
            <span className="mt-1 block text-[3.4rem] sm:text-7xl lg:text-[5.6rem]">Long Lasting</span>
            <span className="block text-[3.4rem] sm:text-7xl lg:text-[5.6rem]">Perfumes</span>
          </h1>
          <p className="mx-auto mt-6 max-w-md text-[15px] leading-7 text-white/75 md:mx-0 md:text-base">
            Rich eau de parfums that stay with you from morning to midnight, inspired by the world&apos;s most-loved scents.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 md:justify-start">
            <p className="text-white/70">
              From <span className="font-heading text-3xl text-white">₹1,455</span> <s className="ml-1 text-sm text-white/45">₹3,333</s>
            </p>
            <span className="rounded-full border border-white/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">Buy 1 Get 1 Free</span>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
            <Link
              href="/shop"
              className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full bg-white px-8 text-[15px] font-semibold normal-case tracking-normal text-primary shadow-lg shadow-black/20 hover:bg-lilac")}
            >
              Shop the collection <ArrowRightIcon />
            </Link>
            <Link
              href="#offer"
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "h-12 rounded-full border-white/45 bg-transparent px-7 text-[15px] font-medium normal-case tracking-normal text-white hover:bg-white/10 hover:text-white",
              )}
            >
              View offer
            </Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[560px]">
          <Image
            src="/brand/hero-bottles.svg"
            alt="StarGod eau de parfum bottles on a glowing pedestal"
            width={800}
            height={760}
            priority
            unoptimized
            className="h-auto w-full motion-safe:animate-[float_7s_ease-in-out_infinite] drop-shadow-[0_30px_40px_rgba(40,8,48,0.45)]"
          />
          <div className="absolute right-2 top-[12%] hidden size-24 flex-col sm:flex items-center justify-center rounded-full bg-white text-primary shadow-2xl ring-8 ring-white/20 sm:size-28">
            <span className="font-heading text-4xl leading-none sm:text-5xl">24</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Hours</span>
          </div>
        </div>
      </div>

      {/* proof strip */}
      <div className="relative border-t border-white/15 bg-black/10 backdrop-blur-sm">
        <ul className="container-page grid grid-cols-3 divide-x divide-white/15 py-5 text-center">
          {[
            ["24h", "Long lasting"],
            ["1500+", "Fragrances in store"],
            ["1 + 1", "Buy 1 Get 1 Free"],
          ].map(([big, small]) => (
            <li key={big} className="px-2">
              <p className="font-heading text-2xl sm:text-3xl">{big}</p>
              <p className="text-[11px] uppercase tracking-[0.15em] text-white/70 sm:text-xs">{small}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: TruckIcon, title: "Free shipping", text: "Across India, above ₹999" },
    { icon: BanknoteIcon, title: "Cash on Delivery", text: "Pay when it arrives" },
    { icon: ShieldCheckIcon, title: "Secure payments", text: "UPI, cards & net banking" },
    { icon: RotateCcwIcon, title: "Easy replacement", text: "For damaged bottles" },
  ];
  return (
    <section className="border-y bg-card">
      <ul className="container-page grid grid-cols-2 gap-y-6 py-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <Icon className="size-6 shrink-0 text-gold" strokeWidth={1.4} />
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ eyebrow, title, id, href }: { eyebrow: string; title: string; id: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-2 text-3xl sm:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm underline-offset-4 hover:underline sm:inline-flex">
          View all <ArrowRightIcon className="size-4" />
        </Link>
      )}
    </div>
  );
}

async function CollectionGrid({ slug }: { slug: string }) {
  const products = await getCollectionProducts(slug, 4);
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

function BrandStory() {
  return (
    <section className="mt-24 bg-primary text-primary-foreground">
      <div className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div className="relative aspect-[5/4] overflow-hidden rounded-md">
          <Image src="/images/products/wise-monk.svg" alt="Wise Monk eau de parfum" fill unoptimized className="object-cover" />
        </div>
        <div className="max-w-lg">
          <p className="eyebrow text-lilac">Our craft</p>
          <h2 className="mt-3 text-4xl sm:text-5xl">Iconic scents, our own story</h2>
          <p className="mt-6 leading-relaxed text-primary-foreground/75">
            Every StarGod fragrance is inspired by a scent profile the world already loves, then blended in small batches as a long-lasting
            eau de parfum with its own name and character. Luxury performance, without the luxury price tag.
          </p>
          <Link href="/about" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-8 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary")}>
            Our story
          </Link>
        </div>
      </div>
    </section>
  );
}

function OfferBanner() {
  const tiers = [
    { slug: "silver", name: "Silver Collection", price: "₹1,455", mrp: "₹3,333", image: "/images/products/end-game.svg", tone: "from-zinc-200 to-zinc-50" },
    { slug: "golden", name: "Golden Collection", price: "₹1,855", mrp: "₹4,444", image: "/images/products/iron-will.svg", tone: "from-amber-200 to-amber-50" },
  ];
  return (
    <section id="offer" className="container-page mt-20 scroll-mt-28">
      <div className="text-center">
        <p className="eyebrow text-gold">Limited-time offer</p>
        <h2 className="mt-2 text-4xl sm:text-5xl">Buy 1 Get 1 Free</h2>
        <p className="mt-3 text-muted-foreground">Add any two perfumes from the same collection, and the second one is free. Applied automatically in your bag.</p>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {tiers.map((t) => (
          <Link key={t.slug} href={`/shop?category=${t.slug}`} className={cn("group grid grid-cols-[1fr_40%] overflow-hidden rounded-md bg-gradient-to-br", t.tone)}>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="font-heading text-3xl">{t.name}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                <s>{t.mrp}</s> <span className="text-lg font-medium text-foreground">{t.price}</span> each
              </p>
              <p className="mt-1 text-sm font-medium text-success">2 perfumes for {t.price}</p>
              <span className={cn(buttonVariants({ size: "sm" }), "mt-5 w-fit")}>Shop {t.slug}</span>
            </div>
            <div className="relative min-h-56">
              <Image src={t.image} alt="" fill unoptimized className="object-cover transition-transform duration-700 group-hover:scale-105" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function Reviews() {
  const reviews = await getLatestReviews(3);
  // Hidden until real (approved) reviews exist.
  if (reviews.length === 0) return null;
  return (
    <section className="container-page mt-20" aria-labelledby="reviews-heading">
      <SectionHeading eyebrow="Real reviews" title="Loved across India" id="reviews-heading" />
    <ul className="mt-8 grid gap-4 md:grid-cols-3">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col rounded-md border bg-card p-6">
          <RatingStars value={r.rating} />
          {r.title && <p className="mt-3 font-heading text-xl">&ldquo;{r.title}&rdquo;</p>}
          {r.body && <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>}
          <p className="mt-4 text-xs text-muted-foreground">
            {r.author} on{" "}
            <Link href={`/products/${r.productSlug}`} className="text-foreground underline-offset-4 hover:underline">
              {r.product}
            </Link>
          </p>
        </li>
      ))}
    </ul>
    </section>
  );
}
