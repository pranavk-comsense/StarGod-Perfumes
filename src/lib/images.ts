export const PRODUCT_IMAGES_BUCKET = "product-images";

/**
 * product_images.storage_path may be an absolute URL, a root-relative path
 * served from /public (seed data), or an object path in the storage bucket.
 */
export function productImageUrl(path: string | null | undefined): string {
  if (!path) return "/images/placeholder.svg";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}
