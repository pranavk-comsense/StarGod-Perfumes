import Link from "next/link";
import { UserIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/dal";
import { isStaffRole, ROLE_LABELS } from "@/lib/auth/roles";
import { AccountDropdown } from "@/components/layout/account-dropdown";
import { CartIdentity } from "@/components/cart/cart-provider";

export function initialsOf(name: string | null, email: string | null) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

/** Header account control; streamed (reads the session) inside a Suspense boundary. */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
      <CartIdentity userId={null} />
      <Link
        href="/login"
        className="flex h-10 items-center gap-1.5 rounded-md px-2 text-sm hover:bg-white/10"
        aria-label="Sign in"
      >
        <UserIcon className="size-5" strokeWidth={1.5} />
        <span className="hidden lg:inline">Sign in</span>
      </Link>
      </>
    );
  }
  return (
    <>
    <CartIdentity userId={user.id} />
    <AccountDropdown
      user={{
        name: user.fullName || "Your account",
        email: user.email,
        initials: initialsOf(user.fullName, user.email),
        isStaff: isStaffRole(user.role),
        roleLabel: ROLE_LABELS[user.role],
      }}
    />
    </>
  );
}

export function AccountMenuFallback() {
  return <span className="size-10" aria-hidden />;
}
