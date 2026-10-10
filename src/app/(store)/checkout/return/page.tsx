import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlertIcon, Clock3Icon } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { syncOrderPayment } from "@/lib/payments/sync";
import { RetryPaymentButton } from "@/components/checkout/retry-payment";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };
export const instant = false;

/**
 * Cashfree redirects here after checkout. We never trust query params: the
 * payment is verified server-side with Cashfree's Get Payments API.
 */
export default async function CheckoutReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  const user = await requireUser("/account/orders");
  const orderNumber = (await searchParams).order;
  if (typeof orderNumber !== "string") redirect("/account/orders");

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("order_number, status, payment_status, reserved_until")
    .eq("order_number", orderNumber)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!order) redirect("/account/orders");
  if (order.payment_status === "paid" || order.status !== "pending_payment") {
    redirect(`/account/orders/${order.order_number}${order.payment_status === "paid" ? "?placed=1" : ""}`);
  }

  let result: string = "pending";
  try {
    result = await syncOrderPayment(order.order_number, "return");
  } catch (e) {
    console.error("[checkout/return] sync", e);
  }
  if (result === "paid" || result === "already_paid") redirect(`/account/orders/${order.order_number}?placed=1`);
  if (result === "needs_refund" || result === "amount_mismatch") redirect(`/account/orders/${order.order_number}`);

  const canRetry = order.reserved_until && new Date(order.reserved_until) > new Date();
  const pending = result === "pending";

  return (
    <div className="container-page max-w-lg py-20 text-center">
      {pending ? <Clock3Icon className="mx-auto size-12 text-gold" strokeWidth={1.2} /> : <CircleAlertIcon className="mx-auto size-12 text-destructive" strokeWidth={1.2} />}
      <h1 className="mt-4 text-4xl">{pending ? "Confirming your payment" : "Payment not completed"}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {pending
          ? "If you completed the payment, it can take a minute to confirm. We'll update your order automatically. No need to pay again."
          : "Your payment didn't go through and you have not been charged. Your items are reserved for a few more minutes."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Order {order.order_number}</p>
      <div className="mt-8 flex flex-col items-center gap-3">
        {pending ? (
          <Link href={`/checkout/return?order=${order.order_number}`} className={buttonVariants({ size: "lg" })}>
            Check again
          </Link>
        ) : canRetry ? (
          <RetryPaymentButton orderNumber={order.order_number} />
        ) : (
          <Link href="/cart" className={buttonVariants({ size: "lg" })}>
            Back to bag
          </Link>
        )}
        <Link href={`/account/orders/${order.order_number}`} className="text-sm underline underline-offset-4">
          View order
        </Link>
      </div>
    </div>
  );
}
