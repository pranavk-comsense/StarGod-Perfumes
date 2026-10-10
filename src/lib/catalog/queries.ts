import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { CategorySlug } from "@/lib/site";
import type { Database } from "@/types/database";

type Gender = Database["public"]["Enums"]["gender"];
type Concentration = Database["public"]["Enums"]["concentration"];

/** Cache tag for everything catalog-related; admin edits call revalidateTag(CATALOG_TAG). */
export const CATALOG_TAG = "catalog";

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  gender: Gender;
  concentration: Concentration;
  isGiftSet: boolean;
  ratingAvg: number;
  ratingCount: number;
  image: string | null;
  /** second image, shown on hover (e.g. packshot behind the mood shot) */
  hoverImage: string | null;
  price: number; // lowest active variant price, paise
  mrp: number; // mrp of that variant
  sizes: string[];
  inStock: boolean;
  createdAt: string;
  families: string[];
  /** e.g. { label: "Buy 1 Get 1", collection: "Silver Collection" } */
  offer: { label: string; collection: string; slug: string } | null;
};

const CARD_SELECT = `
  id, slug, name, tagline, description, gender, concentration, is_gift_set, rating_avg, rating_count, created_at,
  product_variants ( label, price, mrp, stock, sort, is_active ),
  product_images ( storage_path, sort ),
  product_notes ( notes ( name, family ) ),
  product_collections ( collections ( slug, name, bogo, is_active ) )
`;

type CardRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  is_gift_set: boolean;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  product_variants: { label: string; price: number; mrp: number; stock: number; sort: number; is_active: boolean }[];
  product_images: { storage_path: string; sort: number }[];
  product_notes: { notes: { name: string; family: string } | null }[];
  product_collections: { collections: { slug: string; name: string; bogo: boolean; is_active: boolean } | null }[];
};

function toCard(row: CardRow): ProductCardData | null {
  const variants = row.product_variants.filter((v) => v.is_active).sort((a, b) => a.sort - b.sort);
  if (variants.length === 0) return null;
  const cheapest = variants.reduce((min, v) => (v.price < min.price ? v : min), variants[0]);
  const sortedImages = [...row.product_images].sort((a, b) => a.sort - b.sort);
  const image = sortedImages[0]?.storage_path ?? null;
  const hoverImage = sortedImages[1]?.storage_path ?? null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    gender: row.gender,
    concentration: row.concentration,
    isGiftSet: row.is_gift_set,
    ratingAvg: Number(row.rating_avg),
    ratingCount: row.rating_count,
    image,
    hoverImage,
    price: cheapest.price,
    mrp: cheapest.mrp,
    sizes: variants.map((v) => v.label),
    inStock: variants.some((v) => v.stock > 0),
    createdAt: row.created_at,
    families: [...new Set(row.product_notes.map((n) => n.notes?.family).filter((f): f is string => !!f))],
    offer: offerOf(row.product_collections),
  };
}

function offerOf(pcs: { collections: { slug: string; name: string; bogo: boolean; is_active: boolean } | null }[]) {
  const c = pcs.map((p) => p.collections).find((c) => c?.bogo && c.is_active);
  return c ? { label: "Buy 1 Get 1", collection: c.name, slug: c.slug } : null;
}

type ListItem = ProductCardData & { collections: string[]; haystack: string };

async function fetchAllCards(): Promise<ListItem[]> {
  const { data, error } = await createPublicClient().from("products").select(CARD_SELECT).order("name");
  if (error) throw new Error(`Failed to load products: ${error.message}`);
  return (data as unknown as CardRow[]).flatMap((row) => {
    const card = toCard(row);
    if (!card) return [];
    const haystack = [
      row.name,
      row.tagline,
      row.description,
      row.concentration === "attar" ? "attar" : "perfume",
      ...row.product_notes.flatMap((n) => (n.notes ? [n.notes.name, n.notes.family] : [])),
    ]
      .join(" ")
      .toLowerCase();
    return [{ ...card, collections: row.product_collections.map((c) => c.collections?.slug).filter((s): s is string => !!s), haystack }];
  });
}

function withoutCollections(item: ListItem): ProductCardData {
  const card: Partial<ListItem> = { ...item };
  delete card.collections;
  delete card.haystack;
  return card as ProductCardData;
}

export type ShopSort = "featured" | "price-asc" | "price-desc" | "newest" | "rating";

export type ShopFilters = {
  category?: CategorySlug;
  family?: string;
  sort?: ShopSort;
  q?: string;
};

/**
 * Catalog listing. The catalog is small, so we cache the full card list once
 * and filter in memory; swap for SQL filtering when it grows past a few hundred.
 */
export async function getProducts(filters: ShopFilters = {}): Promise<ProductCardData[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  let items = await fetchAllCards();
  const { category, family, sort = "featured", q } = filters;

  if (category) items = items.filter((p) => p.collections.includes(category));

  if (family) items = items.filter((p) => p.families.some((f) => f.toLowerCase() === family.toLowerCase()));
  if (q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
    items = items.filter((p) => terms.every((t) => p.haystack.includes(t) || p.haystack.includes(t.replace(/s$/, ""))));
  }

  const sorted = [...items];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "newest":
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "rating":
      sorted.sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);
      break;
    default:
      sorted.sort((a, b) => Number(b.inStock) - Number(a.inStock) || b.ratingCount - a.ratingCount);
  }
  return sorted.map(withoutCollections);
}

export async function getCollectionProducts(slug: string, limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const items = await fetchAllCards();
  return items
    .filter((p) => p.collections.includes(slug))
    .slice(0, limit)
    .map(withoutCollections);
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  gender: Gender;
  concentration: Concentration;
  isGiftSet: boolean;
  ratingAvg: number;
  ratingCount: number;
  images: { path: string; alt: string | null }[];
  variants: { id: string; label: string; sizeMl: number; price: number; mrp: number; stock: number }[];
  offer: { label: string; collection: string; slug: string } | null;
  notes: { top: string[]; heart: string[]; base: string[] };
  reviews: { id: string; rating: number; title: string | null; body: string | null; isVerified: boolean; author: string; createdAt: string }[];
};

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag(CATALOG_TAG, `product:${slug}`);
  cacheLife("hours");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, name, tagline, description, gender, concentration, is_gift_set, rating_avg, rating_count,
       product_images ( storage_path, alt, sort ),
       product_variants ( id, label, size_ml, price, mrp, stock, sort ),
       product_notes ( tier, notes ( name ) ),
       product_collections ( collections ( slug, name, bogo, is_active ) )`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load product: ${error.message}`);
  if (!data) return null;

  // Reviewer names come from the server-side view below (profiles aren't public).
  const { data: reviews } = await supabase
    .from("public_reviews")
    .select("id, rating, title, body, is_verified, author_name, created_at")
    .eq("product_id", data.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const notes = { top: [] as string[], heart: [] as string[], base: [] as string[] };
  for (const n of data.product_notes) if (n.notes) notes[n.tier].push(n.notes.name);

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    tagline: data.tagline,
    description: data.description,
    gender: data.gender,
    concentration: data.concentration,
    isGiftSet: data.is_gift_set,
    ratingAvg: Number(data.rating_avg),
    ratingCount: data.rating_count,
    images: [...data.product_images].sort((a, b) => a.sort - b.sort).map((i) => ({ path: i.storage_path, alt: i.alt })),
    variants: [...data.product_variants]
      .sort((a, b) => a.sort - b.sort)
      .map((v) => ({ id: v.id, label: v.label, sizeMl: v.size_ml, price: v.price, mrp: v.mrp, stock: v.stock })),
    notes,
    offer: offerOf(data.product_collections as never),
    reviews: (reviews ?? []).map((r) => ({
      id: r.id!,
      rating: r.rating!,
      title: r.title,
      body: r.body,
      isVerified: !!r.is_verified,
      author: r.author_name ?? "Verified customer",
      createdAt: r.created_at!,
    })),
  };
}

export type ReviewHighlight = { id: string; rating: number; title: string | null; body: string | null; author: string; product: string; productSlug: string };

export async function getLatestReviews(limit = 3): Promise<ReviewHighlight[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const { data } = await createPublicClient()
    .from("public_reviews")
    .select("id, rating, title, body, author_name, product_name, product_slug")
    .gte("rating", 4)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id!,
    rating: r.rating!,
    title: r.title,
    body: r.body,
    author: r.author_name ?? "Verified customer",
    product: r.product_name!,
    productSlug: r.product_slug!,
  }));
}
