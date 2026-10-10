"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustStock, moderateReview, saveCoupon, saveSettings } from "@/lib/admin/ops";
import type { FormState } from "@/lib/validation/auth";
import { INDIAN_STATES } from "@/lib/validation/address";
import { CheckboxField, Field, FormAlert, SubmitButton } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectCls = "h-11 rounded-lg border border-input bg-card px-3 text-sm";

function useResultToast(state: FormState, onOk?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      onOk?.();
      router.refresh();
    } else if (state.message && !state.fieldErrors) toast.error(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);
}

export function StockAdjustForm({ variantId }: { variantId: string }) {
  const [state, action] = useActionState(adjustStock, {} as FormState);
  const ref = useRef<HTMLFormElement>(null);
  useResultToast(state, () => ref.current?.reset());
  return (
    <form ref={ref} action={action} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <div>
        <input name="delta" type="number" placeholder="+10 / -2" aria-label="Change" className="h-9 w-24 rounded-md border bg-background px-2 text-sm" required />
        {state.fieldErrors?.delta && <p className="mt-1 text-xs text-destructive">{state.fieldErrors.delta[0]}</p>}
      </div>
      <select name="reason" aria-label="Reason" className="h-9 rounded-md border bg-background px-2 text-sm">
        <option value="restock">Restock</option>
        <option value="adjust">Correction</option>
      </select>
      <input name="note" placeholder="Note (optional)" aria-label="Note" maxLength={200} className="h-9 w-40 rounded-md border bg-background px-2 text-sm" />
      <SubmitButton size="sm" variant="outline" className="w-fit" pendingText="…">
        Apply
      </SubmitButton>
    </form>
  );
}

export type CouponData = {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "flat" | "free_shipping";
  value: number;
  max_discount: number | null;
  min_order: number;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  first_order_only: boolean;
  is_active: boolean;
};

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 16) : "");

export function CouponForm({ coupon }: { coupon?: CouponData }) {
  const [state, action] = useActionState(saveCoupon, {} as FormState);
  useResultToast(state);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const d = (k: string, f: string) => v?.[k] ?? f;
  const valueDefault = coupon ? (coupon.type === "flat" ? String(coupon.value / 100) : coupon.type === "percent" ? String(coupon.value) : "") : "";

  return (
    <form
      action={(fd) => {
        // datetime-local is in IST; send ISO with offset.
        for (const k of ["startsAt", "endsAt"]) {
          const val = fd.get(k);
          if (typeof val === "string" && val) fd.set(k, `${val}:00+05:30`);
        }
        action(fd);
      }}
      className="grid gap-4 sm:grid-cols-2"
      noValidate
    >
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <div className="sm:col-span-2">
        <FormAlert message={state.ok ? undefined : state.message} />
      </div>
      <Field name="code" label="Code" defaultValue={d("code", coupon?.code ?? "")} className="uppercase" errors={e.code} />
      <div className="grid gap-1.5">
        <Label htmlFor="f-type">Type</Label>
        <select id="f-type" name="type" defaultValue={d("type", coupon?.type ?? "percent")} className={selectCls}>
          <option value="percent">Percentage off</option>
          <option value="flat">Flat amount off</option>
          <option value="free_shipping">Free shipping</option>
        </select>
      </div>
      <Field className="sm:col-span-2" name="description" label="Description (shown in cart)" defaultValue={d("description", coupon?.description ?? "")} />
      <Field name="value" label="Value (% or ₹)" type="number" step="0.01" defaultValue={d("value", valueDefault)} errors={e.value} hint="Ignored for free shipping" />
      <Field name="maxDiscount" label="Max discount ₹ (percent only)" type="number" step="0.01" defaultValue={d("maxDiscount", coupon?.max_discount ? String(coupon.max_discount / 100) : "")} />
      <Field name="minOrder" label="Minimum order ₹" type="number" step="0.01" defaultValue={d("minOrder", coupon ? String(coupon.min_order / 100) : "0")} />
      <Field name="usageLimit" label="Total uses (blank = unlimited)" type="number" defaultValue={d("usageLimit", coupon?.usage_limit ? String(coupon.usage_limit) : "")} />
      <Field name="perUserLimit" label="Uses per customer" type="number" min="1" defaultValue={d("perUserLimit", String(coupon?.per_user_limit ?? 1))} />
      <div />
      <Field name="startsAt" label="Starts (IST, optional)" type="datetime-local" defaultValue={toLocal(coupon?.starts_at ?? null)} />
      <Field name="endsAt" label="Ends (IST, optional)" type="datetime-local" defaultValue={toLocal(coupon?.ends_at ?? null)} errors={e.endsAt} />
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <CheckboxField name="isActive" defaultChecked={coupon?.is_active ?? true}>
          Active
        </CheckboxField>
        <CheckboxField name="firstOrderOnly" defaultChecked={coupon?.first_order_only ?? false}>
          First order only
        </CheckboxField>
      </div>
      <SubmitButton className="w-fit" pendingText="Saving…">
        Save coupon
      </SubmitButton>
    </form>
  );
}

export function ReviewModeration({ reviewId, status }: { reviewId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const set = (s: "approved" | "rejected") =>
    startTransition(async () => {
      const r = await moderateReview(reviewId, s);
      if (r.ok) toast.success(s === "approved" ? "Review published" : "Review rejected");
      router.refresh();
    });
  return (
    <div className="flex gap-2">
      {status !== "approved" && (
        <Button size="sm" disabled={pending} onClick={() => set("approved")}>
          Approve
        </Button>
      )}
      {status !== "rejected" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("rejected")}>
          Reject
        </Button>
      )}
    </div>
  );
}

export type SettingsData = {
  store: { name: string; legal_name: string | null; address: string | null; state: string; support_email: string; support_phone: string };
  shipping: { flat_fee: number; free_above: number };
  cod: { enabled: boolean; fee: number; max_order: number };
  checkout: { hold_minutes: number };
};

export function SettingsForm({ settings: s }: { settings: SettingsData }) {
  const [state, action] = useActionState(saveSettings, {} as FormState);
  useResultToast(state);
  const e = state.fieldErrors ?? {};
  const v = state.values;
  const d = (k: string, f: string) => v?.[k] ?? f;
  return (
    <form action={action} className="grid gap-8" noValidate>
      <FormAlert message={state.ok ? undefined : state.message} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-medium">Business details (shown on invoices)</legend>
        <Field name="storeName" label="Store name" defaultValue={d("storeName", s.store.name)} errors={e.storeName} />
        <Field name="legalName" label="Registered business name" defaultValue={d("legalName", s.store.legal_name ?? "")} />
        <div className="grid gap-1.5">
          <Label htmlFor="f-state">State</Label>
          <select id="f-state" name="state" defaultValue={d("state", s.store.state)} className={selectCls}>
            {INDIAN_STATES.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </div>
        <Field className="sm:col-span-2" name="address" label="Registered address" defaultValue={d("address", s.store.address ?? "")} />
        <Field name="supportEmail" label="Support email" type="email" defaultValue={d("supportEmail", s.store.support_email)} errors={e.supportEmail} />
        <Field name="supportPhone" label="Support phone" defaultValue={d("supportPhone", s.store.support_phone)} errors={e.supportPhone} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-medium">Shipping</legend>
        <Field name="shippingFee" label="Shipping fee (₹)" type="number" step="0.01" defaultValue={d("shippingFee", String(s.shipping.flat_fee / 100))} errors={e.shippingFee} />
        <Field name="freeAbove" label="Free shipping above (₹)" type="number" step="0.01" defaultValue={d("freeAbove", String(s.shipping.free_above / 100))} errors={e.freeAbove} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-medium">Cash on Delivery</legend>
        <div className="sm:col-span-2">
          <CheckboxField name="codEnabled" defaultChecked={v ? v.codEnabled === "on" : s.cod.enabled}>
            Offer Cash on Delivery
          </CheckboxField>
        </div>
        <Field name="codFee" label="COD fee (₹)" type="number" step="0.01" defaultValue={d("codFee", String(s.cod.fee / 100))} errors={e.codFee} />
        <Field name="codMax" label="COD allowed up to (₹)" type="number" step="0.01" defaultValue={d("codMax", String(s.cod.max_order / 100))} errors={e.codMax} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-medium">Checkout</legend>
        <Field name="holdMinutes" label="Hold stock for unpaid online orders (minutes)" type="number" defaultValue={d("holdMinutes", String(s.checkout.hold_minutes))} errors={e.holdMinutes} />
      </fieldset>
      <SubmitButton className="w-fit" pendingText="Saving…">
        Save settings
      </SubmitButton>
    </form>
  );
}
