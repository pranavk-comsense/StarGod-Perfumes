import { StarIcon } from "lucide-react";
import { cn } from "cn";

export function RatingStars({ value, className, size = 14 }: { value: number; className?: string; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-gold", className)} aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          aria-hidden
          style={{ width: size, height: size }}
          className={cn(i <= rounded ? "fill-current" : i - 0.5 === rounded ? "fill-current opacity-50" : "fill-none opacity-40")}
        />
      ))}
    </span>
  );
}
