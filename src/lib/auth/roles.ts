import type { Database } from "@/types/database";

export type Role = Database["public"]["Enums"]["user_role"];

const STAFF: readonly Role[] = ["staff", "admin"];
const ADMIN: readonly Role[] = ["admin"];

/**
 * Back-office permissions. The database enforces the same boundaries with RLS
 * (is_staff / is_admin); this map drives the UI and every admin server action.
 */
export const PERMISSIONS = {
  "dashboard.view": STAFF,
  "dashboard.revenue": ADMIN,
  "orders.view": STAFF,
  "orders.manage": STAFF,
  "shipments.manage": STAFF,
  "reviews.moderate": STAFF,
  "inventory.adjust": STAFF,
  "customers.view": STAFF,
  "users.manage_roles": ADMIN,
  "products.manage": ADMIN,
  "coupons.manage": ADMIN,
  "refunds.manage": ADMIN,
  "settings.manage": ADMIN,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isStaffRole(role: Role | null | undefined): boolean {
  return role === "staff" || role === "admin";
}

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
};

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

/**
 * Only same-site relative paths are allowed as a post-login destination, to
 * prevent open redirects (e.g. ?next=https://evil.com or ?next=//evil.com).
 */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  try {
    const url = new URL(next, "http://local");
    if (url.origin !== "http://local") return null;
    if (AUTH_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null;
    if (url.pathname.startsWith("/auth/")) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** Where a user lands after signing in: staff/admin go to the back office, customers back to where they were. */
export function postAuthRedirect(role: Role | null | undefined, next?: unknown): string {
  const target = safeNext(next);
  if (isStaffRole(role)) {
    return target && target.startsWith("/admin") ? target : "/admin";
  }
  if (target && !target.startsWith("/admin")) return target;
  return "/";
}
