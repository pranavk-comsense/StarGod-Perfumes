import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog/queries";
import { categories } from "@/lib/site";
import { INFO_PAGES } from "@/lib/content/pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const products = await getProducts();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((c) => ({ url: `${base}/shop?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...Object.keys(INFO_PAGES).map((slug) => ({ url: `${base}/${slug}`, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
