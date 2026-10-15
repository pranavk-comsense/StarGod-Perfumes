"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addPickupWarehouse, bookReturnAction, cancelReturnAction, resolveNdr, syncAllTracking } from "@/lib/admin/shipping";
import type { FormState } from "@/lib/validation/auth";
import { Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SyncTrackingButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await syncAllTracking();
          if (r.ok) toast.success(r.message);
          else toast.error(r.message);
          router.refresh();
        })
      }
    >
      {pending ? "Syncing…" : "Sync tracking"}
    </Button>
  );
}

type Defaults = { name: string; email: string; phone: string; line1: string; pincode: string };

export function PickupWarehouseForm({ defaults }: { defaults: Defaults }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const r = await addPickupWarehouse(prev, formData);
    if (r.ok) {
      toast.success(r.message);
      setOpen(false);
      router.refresh();
    }
    return r;
  }, {} as FormState);

  if (!open)
    return (
      <Button variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        Add pickup address
      </Button>
    );
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormAlert message={state.ok ? undefined : state.message} />
      <Field name="title" label="Address name" defaultValue="Sadashiv Peth store" errors={state.fieldErrors?.title} />
      <Field name="name" label="Contact name" defaultValue={defaults.name} errors={state.fieldErrors?.name} />
      <Field name="phone" label="Contact mobile" inputMode="numeric" maxLength={10} defaultValue={defaults.phone} errors={state.fieldErrors?.phone} />
      <Field name="email" label="Contact email" type="email" defaultValue={defaults.email} errors={state.fieldErrors?.email} />
      <Field name="line1" label="Address line 1" defaultValue={defaults.line1} errors={state.fieldErrors?.line1} />
      <Field name="line2" label="Address line 2 (optional)" errors={state.fieldErrors?.line2} />
      <Field name="pincode" label="Pincode" inputMode="numeric" maxLength={6} defaultValue={defaults.pincode} errors={state.fieldErrors?.pincode} />
      <div className="flex gap-2">
        <SubmitButton size="sm" className="w-fit" pendingText="Adding…">
          Add to Shipmozo
        </SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, confirmText: string) => {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      router.refresh();
    });
  };
  return [pending, run] as const;
}

export function NdrButtons({ awb }: { awb: string }) {
  const [pending, run] = useRun();
  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" disabled={pending} onClick={() => run(() => resolveNdr(awb, "REATTEMPT"), `Ask the courier to re-attempt delivery of ${awb}?`)}>
        Re-attempt
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveNdr(awb, "RETURN"), `Send ${awb} back to the store (RTO)? Return shipping is charged.`)}>
        Return to store
      </Button>
    </span>
  );
}

export function CancelReturnButton({ orderId, returnId }: { orderId: string; returnId: string }) {
  const [pending, run] = useRun();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelReturnAction(orderId, returnId), "Cancel this return pickup?")}>
      Cancel return
    </Button>
  );
}

export function ReturnForm({ orderId, reasons }: { orderId: string; reasons: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const r = await bookReturnAction(prev, formData);
    if (r.ok) {
      toast.success(r.message);
      setOpen(false);
    }
    router.refresh();
    return r;
  }, {} as FormState);

  if (!open)
    return (
      <Button variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        Arrange return pickup
      </Button>
    );
  return (
    <form action={action} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" noValidate>
      <p className="font-medium sm:col-span-2">Return pickup</p>
      <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">
        Shipmozo sends a courier to collect the parcel from the delivery address and bring it back to the store. Once it arrives, mark the order returned to restock it, then refund.
      </p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ret-reason">Reason</Label>
        <select id="ret-reason" name="reasonId" className="h-11 rounded-lg border bg-card px-3 text-sm" defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.reasonId && <p className="text-xs text-destructive">{state.fieldErrors.reasonId[0]}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ret-request">Customer wants</Label>
        <select id="ret-request" name="request" className="h-11 rounded-lg border bg-card px-3 text-sm" defaultValue="REFUND">
          <option value="REFUND">Refund</option>
          <option value="EXCHANGE">Exchange</option>
        </select>
      </div>
      <Field className="sm:col-span-2" name="comment" label="Note for the courier (optional)" maxLength={200} errors={state.fieldErrors?.comment} />
      <div className="flex gap-2">
        <SubmitButton className="w-fit" pendingText="Booking…">
          Book return pickup
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
