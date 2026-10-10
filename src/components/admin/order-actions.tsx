"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addTrackingUpdate, adminCancelOrder, clearNeedsRefund, markShipped, recheckPayment, refundOrder, saveAdminNote, updateOrderStatus } from "@/lib/admin/orders";
import type { FormState } from "@/lib/validation/auth";
import { Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  orderId: string;
  status: string;
  paymentMethod: "prepaid" | "cod";
  paymentStatus: string;
  activeShipmentId: string | null;
  refundable: number; // paise
  needsRefund: boolean;
  adminNote: string | null;
  canRefund: boolean;
};

function useToastOnResult(state: FormState) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, router]);
}

export function OrderActions(p: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {p.status === "confirmed" && (
          <Button disabled={pending} onClick={() => run(() => updateOrderStatus(p.orderId, "processing"))}>
            Mark as packed
          </Button>
        )}
        {p.status === "shipped" && (
          <>
            <Button disabled={pending} onClick={() => run(() => updateOrderStatus(p.orderId, "delivered"), "Mark this order as delivered?")}>
              Mark delivered
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => run(() => updateOrderStatus(p.orderId, "rto"), "Mark as returning to origin (RTO)?")}>
              Mark RTO
            </Button>
          </>
        )}
        {(p.status === "rto" || p.status === "delivered") && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => updateOrderStatus(p.orderId, "returned"), "Mark as returned? Stock will be added back.")}>
            Mark returned (restock)
          </Button>
        )}
        {p.status === "pending_payment" && (
          <Button variant="outline" disabled={pending} onClick={() => run(() => recheckPayment(p.orderId))}>
            Re-check payment with Cashfree
          </Button>
        )}
        {["pending_payment", "confirmed", "processing"].includes(p.status) && !p.activeShipmentId && <CancelButton orderId={p.orderId} />}
      </div>

      {(p.status === "confirmed" || p.status === "processing") && <ShipForm orderId={p.orderId} />}
      {p.status === "shipped" && p.activeShipmentId && <TrackingForm orderId={p.orderId} shipmentId={p.activeShipmentId} />}
      {p.canRefund && p.refundable > 0 && p.paymentMethod === "prepaid" && <RefundForm orderId={p.orderId} max={p.refundable} needsRefund={p.needsRefund} />}
      {p.canRefund && p.needsRefund && (
        <Button variant="ghost" className="w-fit" disabled={pending} onClick={() => run(() => clearNeedsRefund(p.orderId), "Mark the refund flag as resolved (e.g. refunded outside the system)?")}>
          Clear &ldquo;needs refund&rdquo; flag
        </Button>
      )}
      <NoteForm orderId={p.orderId} note={p.adminNote} />
    </div>
  );
}

function CancelButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!open)
    return (
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Cancel order
      </Button>
    );
  return (
    <div className="flex w-full flex-wrap items-end gap-2 rounded-md border p-3">
      <div className="grid flex-1 gap-1.5">
        <Label htmlFor="cancel-reason">Reason (shown to the customer)</Label>
        <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className="h-10 rounded-md border bg-background px-3 text-sm" placeholder="e.g. Out of stock, unreachable customer" />
      </div>
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await adminCancelOrder(orderId, reason);
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
            setOpen(false);
            router.refresh();
          })
        }
      >
        {pending ? "Cancelling…" : "Confirm cancel"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Back
      </Button>
    </div>
  );
}

function ShipForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(markShipped, {} as FormState);
  useToastOnResult(state);
  return (
    <form action={action} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" noValidate>
      <p className="font-medium sm:col-span-2">Ship this order</p>
      <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Book the pickup with your courier, then enter the AWB here. Shipmozo booking will appear here once connected.</p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <Field name="courier" label="Courier" placeholder="e.g. Delhivery" errors={state.fieldErrors?.courier} />
      <Field name="awb" label="AWB / tracking no." errors={state.fieldErrors?.awb} />
      <Field className="sm:col-span-2" name="trackingUrl" label="Tracking link (optional)" type="url" placeholder="https://" errors={state.fieldErrors?.trackingUrl} />
      <SubmitButton className="w-fit" pendingText="Saving…">
        Mark as shipped
      </SubmitButton>
    </form>
  );
}

function TrackingForm({ orderId, shipmentId }: { orderId: string; shipmentId: string }) {
  const [state, action] = useActionState(addTrackingUpdate, {} as FormState);
  useToastOnResult(state);
  return (
    <form action={action} className="grid gap-3 rounded-md border p-4 sm:grid-cols-3" noValidate>
      <p className="font-medium sm:col-span-3">Add tracking update</p>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="shipmentId" value={shipmentId} />
      <div className="grid gap-1.5">
        <Label htmlFor="t-status">Status</Label>
        <select id="t-status" name="status" className="h-11 rounded-lg border bg-card px-3 text-sm">
          <option value="in_transit">In transit</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">Delivered</option>
          <option value="delayed">Delayed</option>
          <option value="rto">Returning to origin</option>
        </select>
      </div>
      <Field name="location" label="Location (optional)" />
      <Field name="description" label="Note (optional)" />
      <SubmitButton className="w-fit" pendingText="Saving…">
        Add update
      </SubmitButton>
    </form>
  );
}

function RefundForm({ orderId, max, needsRefund }: { orderId: string; max: number; needsRefund: boolean }) {
  const [state, action] = useActionState(refundOrder, {} as FormState);
  useToastOnResult(state);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const amt = new FormData(e.currentTarget).get("amount");
        if (!confirm(`Refund ₹${amt} to the customer's original payment method?`)) e.preventDefault();
      }}
      className="grid gap-3 rounded-md border p-4 sm:grid-cols-2"
      noValidate
    >
      <p className="font-medium sm:col-span-2">
        Refund{needsRefund && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">Refund needed</span>}
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <Field name="amount" label={`Amount (₹, max ${(max / 100).toFixed(2)})`} type="number" step="0.01" min="1" max={(max / 100).toFixed(2)} defaultValue={(max / 100).toFixed(2)} errors={state.fieldErrors?.amount} />
      <Field name="reason" label="Reason" placeholder="e.g. Damaged in transit" errors={state.fieldErrors?.reason} />
      <SubmitButton variant="destructive" className="w-fit" pendingText="Refunding…">
        Issue refund
      </SubmitButton>
    </form>
  );
}

function NoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const [value, setValue] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Label htmlFor="admin-note">Internal note (not visible to the customer)</Label>
      <textarea id="admin-note" value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={2000} className="rounded-md border bg-background px-3 py-2 text-sm" />
      <Button
        variant="outline"
        className="w-fit"
        disabled={pending || value === (note ?? "")}
        onClick={() =>
          startTransition(async () => {
            const r = await saveAdminNote(orderId, value);
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
          })
        }
      >
        Save note
      </Button>
    </div>
  );
}
