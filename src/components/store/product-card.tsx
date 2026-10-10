import Link from "next/link";
import type { ProductCardData } from "@/lib/catalog/queries";
import { ProductImage } from "@/components/store/product-image";
import { Price } from "@/components/store/price";
import { RatingStars } from "@/components/store/rating-stars";

const CONCENTRATION_LABEL: Record<ProductCardData["concentration"], string> = {
  parfum: "Parfum",
  edp: "Eau de Parfum",
  edt: "Eau de Toilette",
  edc: "Eau de Cologne",
  attar: "Attar",
  body_mist: "Body Mist",
};

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-square overflow-hidden rounded-md bg-secondary">
        <ProductImage
          path={product.image}
          alt={product.name}
          priority={priority}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {product.hoverImage && (
          <ProductImage
            path={product.hoverImage}
            alt=""
            className="opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="absolute left-2 top-2 rounded-sm bg-background/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wider">
            Sold out
          </span>
        )}
        {product.offer && product.inStock && (
          <span className="absolute left-2 top-2 rounded-sm bg-primary px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
            {product.offer.label}
          </span>
        )}
        {product.isGiftSet && product.inStock && !product.offer && (
          <span className="absolute left-2 top-2 rounded-sm bg-gold px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-gold-foreground">
            Gift set
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{CONCENTRATION_LABEL[product.concentration]}</p>
        <h3 className="font-heading text-lg leading-tight group-hover:underline group-hover:underline-offset-4">{product.name}</h3>
        {product.tagline && <p className="line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>}
        {product.ratingCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RatingStars value={product.ratingAvg} size={12} />
            <span>({product.ratingCount})</span>
          </div>
        )}
        <Price price={product.price} mrp={product.mrp} from={product.sizes.length > 1} className="mt-auto pt-1" />
      </div>
    </Link>
  );
}

export { CONCENTRATION_LABEL };
