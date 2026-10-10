import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  payment_failed: "Payment failed",
  rto: "Returning to us",
  returned: "Returned",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending_payment: "warning",
  confirmed: "info",
  processing: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "neutral",
  payment_failed: "danger",
  rto: "warning",
  returned: "neutral",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

/** Midnight today in India (IST), as an ISO timestamp. */
export function istStartOfToday(): string {
  const ymd = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Date(`${ymd}T00:00:00+05:30`).toISOString();
}

export function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const CANCEL_REASONS = ["Ordered by mistake", "Found a better price", "Delivery is too slow", "Want to change items or address", "Other"] as const;

/** Customer-facing progress steps. */
export const ORDER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Packed" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

/** Human label for order_status_history.actor values ("staff:<uuid>", "customer:<uuid>", "cashfree:webhook", "system"). */
export function actorLabel(actor: string | null): string {
  if (!actor) return "System";
  const kind = actor.split(":")[0];
  return (
    { staff: "Team", customer: "Customer", cashfree: "Cashfree", return: "Payment return", cron: "Scheduled check", system: "System", test: "Test" } as Record<string, string>
  )[kind] ?? kind;
}
