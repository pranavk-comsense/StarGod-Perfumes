"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordReset,
  resendVerification,
  signIn,
  signInWithGoogle,
  signUp,
  updatePassword,
} from "@/lib/auth/actions";
import type { FormState } from "@/lib/validation/auth";
import { CheckboxField, Field, FormAlert, PasswordField, SubmitButton } from "@/components/forms/form-fields";

const initial: FormState = {};
const PASSWORD_HINT = "At least 8 characters, with upper and lower case letters and a number.";

export function GoogleButton({ next }: { next?: string }) {
  const [state, action] = useActionState(signInWithGoogle, initial);
  return (
    <form action={action} className="grid gap-2">
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton variant="outline" pendingText="Redirecting to Google…">
        <GoogleIcon /> Continue with Google
      </SubmitButton>
      <FormAlert message={state.message} />
    </form>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-4" noValidate>
        {next && <input type="hidden" name="next" value={next} />}
        <FormAlert message={state.message} />
        <Field
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          errors={state.fieldErrors?.email}
        />
        <div className="grid gap-1.5">
          <PasswordField
            name="password"
            label="Password"
            autoComplete="current-password"
            required
            errors={state.fieldErrors?.password}
          />
          <Link href="/forgot-password" className="justify-self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton size="lg" pendingText="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      {state.unverifiedEmail && <ResendVerificationForm email={state.unverifiedEmail} />}
    </div>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, initial);
  const v = state.values ?? {};
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormAlert message={state.message} />
      <Field name="fullName" label="Full name" autoComplete="name" required defaultValue={v.fullName} errors={e.fullName} />
      <Field name="email" label="Email" type="email" autoComplete="email" inputMode="email" required defaultValue={v.email} errors={e.email} />
      <Field
        name="phone"
        label="Mobile number (optional)"
        type="tel"
        autoComplete="tel-national"
        inputMode="numeric"
        placeholder="10-digit mobile"
        defaultValue={v.phone}
        errors={e.phone}
        hint="For delivery updates. We never share it."
      />
      <PasswordField name="password" label="Password" autoComplete="new-password" required errors={e.password} hint={PASSWORD_HINT} />
      <PasswordField name="confirmPassword" label="Confirm password" autoComplete="new-password" required errors={e.confirmPassword} />
      <CheckboxField name="terms" errors={e.terms} defaultChecked={v.terms === "on"}>
        I agree to the{" "}
        <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-2">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </CheckboxField>
      <CheckboxField name="marketing" defaultChecked={v.marketing === "on"}>
        Send me new launches and offers by email. (Optional)
      </CheckboxField>
      <SubmitButton size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerification, initial);
  return (
    <form action={action} className="grid gap-3 rounded-md border bg-card p-4">
      <input type="hidden" name="email" value={email} />
      <p className="text-sm text-muted-foreground">
        Didn&apos;t get the email? Check your spam folder, or send a new link to <span className="text-foreground">{email}</span>.
      </p>
      <FormAlert message={state.message} ok={state.ok} />
      <SubmitButton variant="outline" pendingText="Sending…">
        Resend confirmation email
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state.ok) {
    return (
      <div className="grid gap-4">
        <FormAlert ok message={state.message} />
        <Link href="/login" className="text-center text-sm underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert message={state.message} />
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton size="lg" pendingText="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert message={state.message} />
      {state.message?.includes("expired") && (
        <Link href="/forgot-password" className="text-sm underline underline-offset-4">
          Request a new reset link
        </Link>
      )}
      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.password}
        hint={PASSWORD_HINT}
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton size="lg" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
