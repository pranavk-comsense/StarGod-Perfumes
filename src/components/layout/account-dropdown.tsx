"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LayoutDashboardIcon, LogOutIcon, PackageIcon, UserIcon, ShieldCheckIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/actions";

export type AccountSummary = { name: string; email: string | null; initials: string; isStaff: boolean; roleLabel: string };

export function AccountDropdown({ user }: { user: AccountSummary }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="flex size-10 items-center justify-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-[11px] font-bold tracking-wider text-primary">
          {user.initials}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
            {user.isStaff && (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-gold">
                <ShieldCheckIcon className="size-3" /> {user.roleLabel}
              </p>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {user.isStaff && (
          <DropdownMenuItem render={<Link href="/admin" />}>
            <LayoutDashboardIcon /> Admin dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserIcon /> My account
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/orders" />}>
          <PackageIcon /> My orders
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={() => startTransition(() => signOut())}>
          <LogOutIcon /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
