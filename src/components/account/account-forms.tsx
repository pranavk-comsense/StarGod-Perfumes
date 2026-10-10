"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { changePassword, signOutEverywhere, updateProfile } from "@/lib/auth/actions";
import { deleteAccount } from "@/lib/account/actions";
import type { FormState } from "@/lib/validation/auth";
import { CheckboxField, Field, FormAlert, PasswordField, SubmitButton } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";

const initial: FormState = {};

export function ProfileForm({
  defaults,
}: {
  defaults: { fullName: string; email: string; phone: string; marketing: boolean };
}) {
  const [state, action] = useActionState(updateProfile, initial);
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
  }, [state]);
  const v = state.values;
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      {!state.ok && <FormAlert message={state.message} />}
      <Field name="fullName" label="Full name" autoComplete="name" required defaultValue={v?.fullName ?? defaults.fullName} errors={state.fieldErrors?.fullName} />
      <Field name="email" label="Email" type="email" value={defaults.email} readOnly disabled hint="Contact support to change your email." />
      <Field
        name="phone"
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        defaultValue={v?.phone ?? defaults.phone}
        errors={state.fieldErrors?.phone}
      />
      <CheckboxField name="marketing" defaultChecked={v ? v.marketing === "on" : defaults.marketing}>
        Email me new launches and offers.
      </CheckboxField>
      <SubmitButton className="w-fit" pendingText="Saving…">
        Save changes
      </SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      toast.success(state.message);
    }
  }, [state]);
  return (
    <form ref={formRef} action={action} className="grid max-w-md gap-4" noValidate>
      {!state.ok && <FormAlert message={state.message} />}
      <PasswordField name="currentPassword" label="Current password" autoComplete="current-password" required errors={state.fieldErrors?.currentPassword} />
      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.password}
        hint="At least 8 characters, with upper and lower case letters and a number."
      />
      <PasswordField name="confirmPassword" label="Confirm new password" autoComplete="new-password" required errors={state.fieldErrors?.confirmPassword} />
      <SubmitButton className="w-fit" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}

export function SignOutEverywhereButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (confirm("Sign out of StarGod on every device, including this one?")) startTransition(() => signOutEverywhere());
      }}
    >
      {pending ? "Signing out…" : "Sign out of all devices"}
    </Button>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, initial);
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormAlert message={state.message} />
      <Field name="confirm" label='Type "DELETE" to confirm' autoComplete="off" errors={state.fieldErrors?.confirm} />
      <SubmitButton variant="destructive" className="w-fit" pendingText="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
