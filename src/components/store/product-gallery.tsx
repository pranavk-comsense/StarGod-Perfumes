"use client";

import { useState } from "react";
import { cn } from "cn";
import { ProductImage } from "@/components/store/product-image";

export function ProductGallery({ images, name }: { images: { path: string; alt: string | null }[]; name: string }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : [{ path: "", alt: name }];
  const current = list[Math.min(active, list.length - 1)];

  return (
    <div className={cn("grid gap-3 lg:gap-4", list.length > 1 && "lg:grid-cols-[72px_1fr]")}>
      <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-md bg-secondary lg:order-2">
        <ProductImage path={current.path} alt={current.alt ?? name} priority sizes="(min-width: 1024px) 45vw, 100vw" />
      </div>
      {list.length > 1 && (
        <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:flex-col">
          {list.map((img, i) => (
            <button
              key={img.path + i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === active}
              className={cn("relative aspect-[4/5] w-16 shrink-0 overflow-hidden rounded border-2 lg:w-full", i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <ProductImage path={img.path} alt="" sizes="72px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
