import { cn } from "cn";
import { discountPercent, formatINR } from "@/lib/money";

export function Price({
  price,
  mrp,
  from = false,
  size = "md",
  className,
}: {
  price: number;
  mrp: number;
  from?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const off = discountPercent(price, mrp);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-medium", size === "lg" ? "text-2xl" : "text-[15px]")}>
        {from && <span className="mr-1 text-xs font-normal text-muted-foreground">from</span>}
        {formatINR(price)}
      </span>
      {off > 0 && (
        <>
          <s className={cn("text-muted-foreground", size === "lg" ? "text-base" : "text-xs")}>{formatINR(mrp)}</s>
          <span className={cn("font-medium text-success", size === "lg" ? "text-sm" : "text-xs")}>{off}% off</span>
        </>
      )}
    </div>
  );
}
