import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, isStaffRole, type Permission, type Role } from "@/lib/auth/roles";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  role: Role;
  marketingOptIn: boolean;
  createdAt: string;
};

/**
 * The signed-in user and their profile, verified against the JWT signature
 * (getClaims), deduplicated per request. Returns null when signed out.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, marketing_opt_in, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    phone: profile.phone,
    role: profile.role,
    marketingOptIn: profile.marketing_opt_in,
    createdAt: profile.created_at,
  };
});

/** Any signed-in user; otherwise redirect to login and come back. */
export async function requireUser(returnTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  return user;
}

/** Staff or admin. Customers get a 404 so the back office isn't revealed. */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isStaffRole(user.role)) notFound();
  return user;
}

/** Use at the top of every admin page and server action. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireStaff();
  if (!can(user.role, permission)) notFound();
  return user;
}
