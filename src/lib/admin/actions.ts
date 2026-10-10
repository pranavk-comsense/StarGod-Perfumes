"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/lib/validation/auth";

const roleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["customer", "staff", "admin"]),
});

const ROLE_ERRORS: Record<string, string> = {
  CANNOT_CHANGE_OWN_ROLE: "You can't change your own role.",
  LAST_ADMIN: "There must always be at least one admin.",
  USER_NOT_FOUND: "That user no longer exists.",
};

/** Admin-only: promote/demote a user. Audited in admin_audit_log by set_user_role(). */
export async function changeUserRole(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requirePermission("users.manage_roles");
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Invalid request." };

  const { error } = await createAdminClient().rpc("set_user_role", {
    p_actor: actor.id,
    p_target: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) {
    const key = Object.keys(ROLE_ERRORS).find((k) => error.message.includes(k));
    if (!key) console.error("[admin] set_user_role", error.message);
    return { message: key ? ROLE_ERRORS[key] : "Couldn't update the role. Please try again." };
  }

  revalidatePath("/admin/customers");
  return { ok: true, message: "Role updated." };
}
