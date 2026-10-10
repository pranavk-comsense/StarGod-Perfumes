import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";
import { getProducts, PRICE_RANGES, type PriceRange, type ShopSort } from "@/lib/catalog/queries";
import { categories, fragranceFamilies, type CategorySlug } from "@/lib/site";
import { ProductCard } from "@/components/store/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { SortSelect } from "@/components/store/sort-select";

export const metadata: Metadata = {
  title: "Shop perfumes",
  description: "Shop long-lasting 100 ml perfumes for men and women. Buy 1 Get 1 free on Silver & Golden collections."
};

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

type Params = { category?: CategorySlug; family?: string; sort: ShopSort; q?: string; price?: PriceRange };

function parse(sp: Record<string, string | string[] | undefined>): Params {
  const one = (v: unknown) => (typeof v === "string" ? v : undefined);
  const category = categories.find((c) => c.slug === one(sp.category))?.slug;
  const family = fragranceFamilies.find((f) => f.toLowerCase() === one(sp.family)?.toLowerCase());
  const sort = SORTS.find((s) => s.value === one(sp.sort))?.value ?? "featured";
  const q = one(sp.q)?.trim().slice(0, 60) || undefined;
  const price = one(sp.price) && one(sp.price)! in PRICE_RANGES ? (one(sp.price) as PriceRange) : undefined;
  return { category, family: family?.toLowerCase(), sort, q, price };
}

function href(p: Partial<Params>) {
  const q = new URLSearchParams();
  if (p.category) q.set("category", p.category);
  if (p.family) q.set("family", p.family);
  if (p.price) q.set("price", p.price);
  if (p.q) q.set("q", p.q);
  if (p.sort && p.sort !== "featured") q.set("sort", p.sort);
  const s = q.toString();
  return s ? `/shop?${s}` : "/shop";
}

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <div className="container-page py-10">
      <Suspense fallback={<ShopSkeleton />}>
        <ShopContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ShopContent({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const params = parse(await searchParams);
  const products = await getProducts(params);
  const category = categories.find((c) => c.slug === params.category);
  const family = fragranceFamilies.find((f) => f.toLowerCase() === params.family);

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>{" "}
        / <span className="text-foreground">{category?.label ?? "Shop"}</span>
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">
            {params.q ? `Results for “${params.q}”` : category ? (category.slug === "silver" || category.slug === "golden" ? `${category.label} Collection` : `${category.label} fragrances`) : "All fragrances"}
            {family && <span className="text-muted-foreground"> · {family}</span>}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>
        <SortSelect value={params.sort} options={SORTS} hrefs={Object.fromEntries(SORTS.map((s) => [s.value, href({ ...params, sort: s.value })]))} />
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        <Chip active={!params.category} href={href({ ...params, category: undefined })}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.slug} active={params.category === c.slug} href={href({ ...params, category: c.slug })}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {fragranceFamilies.map((f) => {
          const active = params.family === f.toLowerCase();
          return (
            <Chip key={f} subtle active={active} href={href({ ...params, family: active ? undefined : f.toLowerCase() })}>
              {f}
            </Chip>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
        {(Object.keys(PRICE_RANGES) as PriceRange[]).map((key) => {
          const active = params.price === key;
          return (
            <Chip key={key} subtle active={active} href={href({ ...params, price: active ? undefined : key })}>
              {PRICE_RANGES[key].label}
            </Chip>
          );
        })}
        {params.q && (
          <Chip subtle active={false} href={href({ ...params, q: undefined })}>
            Clear search ✕
          </Chip>
        )}
      </div>

      {products.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="font-heading text-2xl">No fragrances match these filters</p>
          <Link href="/shop" className="mt-4 inline-block text-sm underline underline-offset-4">
            Clear filters
          </Link>
        </div>
      )}
    </>
  );
}

function Chip({ href, active, subtle, children }: { href: string; active: boolean; subtle?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : subtle ? "border-transparent bg-secondary hover:bg-accent" : "bg-card hover:border-foreground/40",
      )}
    >
      {children}
    </Link>
  );
}

function ShopSkeleton() {
  return (
    <>
      <Skeleton className="h-12 w-72" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-[4/5]" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </>
  );
}
