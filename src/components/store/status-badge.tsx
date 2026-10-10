import { cn } from "cn";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, type OrderStatus } from "@/lib/orders/format";

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-transparent ring-inset", TONES[ORDER_STATUS_TONE[status]], className)}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}
