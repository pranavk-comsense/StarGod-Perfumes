import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

// Reached from the emailed recovery link via /auth/confirm, which signs the user
// in with a recovery session. The proxy sends visitors without a session to /forgot-password.
export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-4xl">Set a new password</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose a strong password you haven&apos;t used here before.</p>
      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </>
  );
}
