import { requireUser } from "@/lib/auth/dal";
import { AccountNav } from "@/components/account/account-nav";

// Auth-gated: render on the server only after the session is verified, so
// protected content never flashes for signed-out visitors.
export const instant = false;

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const user = await requireUser("/account");
  return (
    <div className="container-page py-10 lg:py-14">
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 text-4xl">Hello, {user.fullName?.split(" ")[0] || "there"}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
