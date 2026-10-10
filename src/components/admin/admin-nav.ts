import type { Permission } from "@/lib/auth/roles";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
  /** Phase in which the screen ships; items with `phase` render as "coming soon". */
  phase?: number;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard.view" },
  { href: "/admin/orders", label: "Orders", icon: "orders", permission: "orders.view" },
  { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customers.view" },
  { href: "/admin/shipments", label: "Shipments", icon: "shipments", permission: "shipments.manage" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory.adjust" },
  { href: "/admin/reviews", label: "Reviews", icon: "reviews", permission: "reviews.moderate" },
  { href: "/admin/products", label: "Products", icon: "products", permission: "products.manage" },
  { href: "/admin/coupons", label: "Coupons", icon: "coupons", permission: "coupons.manage" },
  { href: "/admin/refunds", label: "Refunds", icon: "refunds", permission: "refunds.manage" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "settings.manage" },
  { href: "/admin/activity", label: "Activity log", icon: "activity", permission: "settings.manage" },
];
