import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/dal";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { ADMIN_NAV } from "@/components/admin/admin-nav";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin | StarGod" }, robots: { index: false, follow: false } };

// Auth-gated: the role check must finish before anything renders.
export const instant = false;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  const items = ADMIN_NAV.filter((i) => can(user.role, i.permission));
  const summary = { name: user.fullName || "Team member", email: user.email, roleLabel: ROLE_LABELS[user.role] };

  return (
    <div className="flex min-h-dvh bg-muted/40">
      <AdminSidebar items={items} user={summary} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background px-4 lg:hidden">
          <AdminMobileNav items={items} user={summary} />
          <span className="font-brand text-lg font-extrabold text-primary">StarGod</span>
          <span className="ml-auto text-xs text-muted-foreground">{summary.roleLabel}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
