"use client";

import { useActionState, useEffect } from "react";
import { saveAddress } from "@/lib/account/actions";
import { INDIAN_STATES, type Address } from "@/lib/validation/address";
import type { FormState } from "@/lib/validation/auth";
import { CheckboxField, Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Label } from "@/components/ui/label";

export function AddressForm({
  address,
  defaultName,
  defaultPhone,
  onSaved,
  submitLabel = "Save address",
}: {
  address?: Address;
  defaultName?: string;
  defaultPhone?: string;
  onSaved?: (addressId: string) => void;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(saveAddress, {} as FormState & { addressId?: string });
  useEffect(() => {
    if (state.ok && state.addressId) onSaved?.(state.addressId);
  }, [state, onSaved]);

  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  const val = (k: keyof Address, fallback = "") => v[k] ?? (address?.[k] as string | null | undefined) ?? fallback;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <Field name="name" label="Full name" autoComplete="name" defaultValue={val("name", defaultName)} errors={e.name} />
      <Field name="phone" label="Mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" defaultValue={val("phone", defaultPhone)} errors={e.phone} />
      <Field className="sm:col-span-2" name="line1" label="House / flat no., building, street" autoComplete="address-line1" defaultValue={val("line1")} errors={e.line1} />
      <Field name="line2" label="Area / locality (optional)" autoComplete="address-line2" defaultValue={val("line2")} errors={e.line2} />
      <Field name="landmark" label="Landmark (optional)" defaultValue={val("landmark")} errors={e.landmark} />
      <Field name="pincode" label="Pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={val("pincode")} errors={e.pincode} />
      <Field name="city" label="City" autoComplete="address-level2" defaultValue={val("city")} errors={e.city} />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="f-state">State</Label>
        <select
          id="f-state"
          name="state"
          defaultValue={val("state")}
          autoComplete="address-level1"
          aria-invalid={e.state ? true : undefined}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        >
          <option value="">Choose a state</option>
          {INDIAN_STATES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {e.state && <p className="text-xs text-destructive">{e.state[0]}</p>}
      </div>
      <div className="sm:col-span-2">
        <CheckboxField name="isDefault" defaultChecked={v.isDefault ? v.isDefault === "on" : address?.is_default}>
          Make this my default address
        </CheckboxField>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-fit" pendingText="Saving…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
