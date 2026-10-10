"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelMyOrder } from "@/lib/orders/actions";
import { CANCEL_REASONS } from "@/lib/orders/format";
import { Button } from "@/components/ui/button";

export function CancelOrder({ orderNumber, prepaid }: { orderNumber: string; prepaid: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
    );
  }
  return (
    <div className="grid gap-3 rounded-md border bg-card p-4">
      <p className="text-sm font-medium">Why are you cancelling?</p>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
        {CANCEL_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      {prepaid && <p className="text-xs text-muted-foreground">If you&apos;ve paid online, the full amount is refunded to your original payment method.</p>}
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelMyOrder(orderNumber, reason);
              if (res.ok) {
                toast.success(res.message);
                setOpen(false);
                router.refresh();
              } else toast.error(res.message);
            })
          }
        >
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Keep order
        </Button>
      </div>
    </div>
  );
}
