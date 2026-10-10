import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ChangePasswordForm, DeleteAccountForm, SignOutEverywhereButton } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Password & security" };

export default async function SecurityPage() {
  await requireUser("/account/security");
  return (
    <div className="grid gap-6">
      <section className="rounded-md border bg-card p-6">
        <h2 className="font-sans text-base font-medium">Change password</h2>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">Other devices are signed out when you change it.</p>
        <ChangePasswordForm />
      </section>
      <section className="rounded-md border bg-card p-6">
        <h2 className="font-sans text-base font-medium">Active sessions</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Lost a device or signed in somewhere public? Sign out everywhere.</p>
        <SignOutEverywhereButton />
      </section>
      <section className="rounded-md border border-destructive/30 bg-card p-6">
        <h2 className="font-sans text-base font-medium text-destructive">Delete account</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Permanently removes your profile, saved addresses, wishlist and bag. Past orders are kept anonymised for our accounting records. You
          can&apos;t delete your account while an order is in progress.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
