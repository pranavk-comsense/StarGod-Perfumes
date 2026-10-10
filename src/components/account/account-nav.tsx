"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { HeartIcon, LayoutGridIcon, LogOutIcon, MapPinIcon, PackageIcon, ShieldIcon, UserIcon } from "lucide-react";
import { cn } from "cn";
import { signOut } from "@/lib/auth/actions";

const ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutGridIcon },
  { href: "/account/orders", label: "Orders", icon: PackageIcon },
  { href: "/account/wishlist", label: "Wishlist", icon: HeartIcon },
  { href: "/account/addresses", label: "Addresses", icon: MapPinIcon },
  { href: "/account/profile", label: "Profile", icon: UserIcon },
  { href: "/account/security", label: "Password & security", icon: ShieldIcon },
];

export function AccountNav() {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <nav aria-label="Account" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/account" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors",
              active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => signOut())}
        className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground lg:mt-4 lg:border-t lg:pt-4"
      >
        <LogOutIcon className="size-4" /> {pending ? "Signing out…" : "Sign out"}
      </button>
    </nav>
  );
}
