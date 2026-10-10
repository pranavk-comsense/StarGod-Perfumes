import Image from "next/image";
import { cn } from "cn";
import { productImageUrl } from "@/lib/images";

/** Product imagery. SVG placeholders skip the optimiser; real photos go through next/image. */
export function ProductImage({
  path,
  alt,
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
  className,
}: {
  path: string | null | undefined;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = productImageUrl(path);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // SVG placeholders and local-dev Supabase URLs skip the optimiser (next/image
      // refuses private IPs by default, which protects against SSRF).
      unoptimized={src.endsWith(".svg") || /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(src)}
      className={cn("object-cover", className)}
    />
  );
}
