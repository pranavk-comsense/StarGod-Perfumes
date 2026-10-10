import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/dal";
import { ProfileForm } from "@/components/account/account-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  return (
    <section className="rounded-md border bg-card p-6">
      <h2 className="font-sans text-base font-medium">Personal details</h2>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">Used for your orders and delivery updates.</p>
      <ProfileForm
        defaults={{
          fullName: user.fullName ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          marketing: user.marketingOptIn,
        }}
      />
    </section>
  );
}
