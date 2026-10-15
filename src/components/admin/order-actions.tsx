"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addTrackingUpdate, adminCancelOrder, clearNeedsRefund, markShipped, recheckPayment, refundOrder, saveAdminNote, updateOrderStatus } from "@/lib/admin/orders";
import { bookShipment, cancelShipmentAction, getShippingQuote, refreshTracking } from "@/lib/admin/shipping";
import type { ShipmozoRate } from "@/lib/shipping/shipmozo";
import { formatINR } from "@/lib/money";
import type { FormState } from "@/lib/validation/auth";
import { Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Props = {
  orderId: string;
  status: string;
  paymentMethod: "prepaid" | "cod";
  paymentStatus: string;
  activeShipment: { id: string; provider: string; awb: string | null } | null;
  shipmozo: boolean;
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
        {p.status === "shipped" && p.activeShipment?.provider === "shipmozo" && p.activeShipment.awb && (
          <>
            <a href={`/admin/shipments/label/${encodeURIComponent(p.activeShipment.awb)}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
              Print label
            </a>
            <Button variant="outline" disabled={pending} onClick={() => run(() => refreshTracking(p.orderId))}>
              Refresh tracking
            </Button>
          </>
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
        {p.status === "shipped" && p.activeShipment && (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              run(
                () => cancelShipmentAction(p.orderId, ""),
                p.activeShipment?.provider === "shipmozo" ? "Cancel this courier booking with Shipmozo? The order goes back to packed." : "Remove this shipment? The order goes back to packed.",
              )
            }
          >
            Cancel shipment
          </Button>
        )}
        {["pending_payment", "confirmed", "processing"].includes(p.status) && !p.activeShipment && <CancelButton orderId={p.orderId} />}
      </div>

      {(p.status === "confirmed" || p.status === "processing") && (p.shipmozo ? <ShipmozoBooking orderId={p.orderId} /> : <ShipForm orderId={p.orderId} />)}
      {p.status === "shipped" && p.activeShipment && <TrackingForm orderId={p.orderId} shipmentId={p.activeShipment.id} />}
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

function ShipmozoBooking({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [rates, setRates] = useState<ShipmozoRate[] | null>(null);
  const [courierId, setCourierId] = useState("");
  const [error, setError] = useState<string>();
  const [manual, setManual] = useState(false);
  const [pending, startTransition] = useTransition();

  const loadRates = () =>
    startTransition(async () => {
      setError(undefined);
      const r = await getShippingQuote(orderId);
      if (!r.ok) return setError(r.message);
      setRates(r.rates);
      setCourierId(r.rates[0]?.courierId ?? "");
    });

  const book = () => {
    const chosen = rates?.find((r) => r.courierId === courierId);
    if (!chosen || !confirm(`Book ${chosen.name} for ${formatINR(chosen.total)}? The pickup will be scheduled and the customer emailed.`)) return;
    startTransition(async () => {
      setError(undefined);
      const r = await bookShipment(orderId, courierId);
      if (r.ok) toast.success(r.message);
      else {
        toast.error(r.message);
        setError(r.message);
      }
      router.refresh();
    });
  };

  if (manual)
    return (
      <div className="grid gap-2">
        <ShipForm orderId={orderId} />
        <Button variant="ghost" className="w-fit" onClick={() => setManual(false)}>
          &larr; Book with Shipmozo instead
        </Button>
      </div>
    );

  return (
    <div className="grid gap-3 rounded-md border p-4">
      <p className="font-medium">Ship with Shipmozo</p>
      <p className="-mt-2 text-xs text-muted-foreground">Compare courier rates for this parcel, then book. Shipmozo issues the AWB and schedules the pickup.</p>
      <FormAlert message={error} />
      {rates === null ? (
        <Button className="w-fit" disabled={pending} onClick={loadRates}>
          {pending ? "Fetching rates…" : "Get courier rates"}
        </Button>
      ) : rates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courier serves this pincode for this payment type.</p>
      ) : (
        <>
          <ul className="grid max-h-80 gap-1.5 overflow-y-auto text-sm" role="radiogroup" aria-label="Courier">
            {rates.map((r, i) => (
              <li key={r.courierId}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" name="courier" value={r.courierId} checked={courierId === r.courierId} onChange={() => setCourierId(r.courierId)} />
                  <span className="flex-1">
                    {r.name}
                    {i === 0 && <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">Cheapest</span>}
                    <span className="block text-xs text-muted-foreground">
                      {r.etaDays ? `~${r.etaDays} day${r.etaDays > 1 ? "s" : ""}` : "ETA n/a"}
                      {r.codCharges > 0 && ` · incl. COD ${formatINR(r.codCharges)}`}
                      {r.minChargeableWeight && ` · min ${r.minChargeableWeight}`}
                    </span>
                  </span>
                  <span className="font-medium">{formatINR(r.total)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !courierId} onClick={book}>
              {pending ? "Booking…" : "Book shipment"}
            </Button>
            <Button variant="outline" disabled={pending} onClick={loadRates}>
              Refresh rates
            </Button>
          </div>
        </>
      )}
      <Button variant="link" className="h-auto w-fit p-0 text-xs" onClick={() => setManual(true)}>
        Shipped outside Shipmozo? Enter the AWB manually
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
      <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Book the pickup with your courier, then enter the AWB here.</p>
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
