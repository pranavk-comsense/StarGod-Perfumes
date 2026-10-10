"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { retryPayment } from "@/lib/checkout/actions";
import { openCashfreeCheckout } from "@/components/checkout/open-cashfree";
import { Button } from "@/components/ui/button";

export function RetryPaymentButton({ orderNumber }: { orderNumber: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(undefined);
            const res = await retryPayment(orderNumber);
            if (!res.ok) return setError(res.message);
            if (res.kind === "prepaid") {
              try {
                await openCashfreeCheckout(res.paymentSessionId, res.mode);
              } catch {
                setError("Couldn't open the payment page. Please try again.");
              }
            }
          })
        }
      >
        {pending && <Loader2Icon className="animate-spin" />} Try payment again
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
