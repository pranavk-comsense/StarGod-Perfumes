"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ActivityIcon,
  BoxesIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  SettingsIcon,
  StoreIcon,
  TruckIcon,
  UndoIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { signOut } from "@/lib/auth/actions";
import type { AdminNavItem } from "@/components/admin/admin-nav";
import { Logo } from "@/components/brand/logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ICONS = {
  dashboard: LayoutDashboardIcon,
  orders: ReceiptIcon,
  customers: UsersIcon,
  shipments: TruckIcon,
  inventory: BoxesIcon,
  reviews: MessageSquareIcon,
  products: PackageIcon,
  coupons: PercentIcon,
  refunds: UndoIcon,
  settings: SettingsIcon,
  activity: ActivityIcon,
} as const;

type Props = { items: AdminNavItem[]; user: { name: string; email: string | null; roleLabel: string } };

export function AdminSidebar(props: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <SidebarBody {...props} />
    </aside>
  );
}

export function AdminMobileNav(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open admin menu" className="flex size-10 items-center justify-center rounded-md hover:bg-muted lg:hidden">
        <MenuIcon className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
        <SheetTitle className="sr-only">Admin navigation</SheetTitle>
        <div className="flex h-full flex-col bg-sidebar" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
          <SidebarBody {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SidebarBody({ items, user }: Props) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Logo size="sm" showTagline={false} href="/admin" />
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">Admin</span>
      </div>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
        <ul className="grid gap-0.5">
          {items.map((item) => {
            const Icon = ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboardIcon;
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            if (item.phase) {
              return (
                <li key={item.href}>
                  <span
                    aria-disabled
                    title={`Ships in phase ${item.phase}`}
                    className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
                  >
                    <Icon className="size-4" /> {item.label}
                    <span className="ml-auto rounded bg-muted px-1.5 text-[10px] uppercase tracking-wide">Soon</span>
                  </span>
                </li>
              );
            }
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-sidebar-accent",
                  )}
                >
                  <Icon className="size-4" /> {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t p-3">
        <Link href="/" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
          <StoreIcon className="size-4" /> View store
        </Link>
        <div className="mt-2 rounded-md px-3 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.roleLabel} · {user.email}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => signOut())}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOutIcon className="size-4" /> {pending ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </>
  );
}
