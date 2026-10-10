"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/dal";
import { addressSchema } from "@/lib/validation/address";
import { fieldErrors, formValues, type FormState } from "@/lib/validation/auth";

const MAX_ADDRESSES = 10;

/** Create or update a saved address (RLS ensures users only touch their own). */
export async function saveAddress(_prev: FormState, formData: FormData): Promise<FormState & { addressId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { message: "Please sign in again." };

  const values = formValues(formData);
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const id = z.uuid().safeParse(formData.get("id")).data;
  const supabase = await createClient();
  const { isDefault, ...a } = parsed.data;

  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (!id && (count ?? 0) >= MAX_ADDRESSES) return { message: `You can save up to ${MAX_ADDRESSES} addresses.`, values };
  const makeDefault = isDefault === "on" || (count ?? 0) === 0;

  if (makeDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  }
  const row = { ...a, is_default: makeDefault, user_id: user.id };
  const { data, error } = id
    ? await supabase.from("addresses").update(row).eq("id", id).select("id").single()
    : await supabase.from("addresses").insert(row).select("id").single();
  if (error) {
    console.error("[address]", error.message);
    return { message: "Couldn't save the address. Please try again.", values };
  }
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { ok: true, message: "Address saved.", addressId: data.id };
}

export async function deleteAddress(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account/addresses");
  return { ok: !error };
}

export async function setDefaultAddress(id: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(id).success) return { ok: false };
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/account/addresses");
  return { ok: !error };
}

export async function removeFromWishlist(productId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !z.uuid().safeParse(productId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("product_id", productId);
  revalidatePath("/account/wishlist");
  return { ok: !error };
}

/**
 * DPDP-compliant account deletion: personal data is removed/anonymised; orders
 * are kept (anonymised) for accounting. The login is soft-deleted.
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.email) return { message: "Please sign in again." };
  if (formData.get("confirm") !== "DELETE") return { fieldErrors: { confirm: ['Type DELETE to confirm'] } };

  const admin = createAdminClient();
  const { error } = await admin.rpc("anonymize_user", { p_user_id: user.id });
  if (error) {
    if (error.message.includes("OPEN_ORDERS")) return { message: "You have orders in progress. You can delete your account once they're delivered or cancelled." };
    if (error.message.includes("STAFF_ACCOUNT")) return { message: "Team accounts can't be deleted here. Ask an admin to change your role first." };
    console.error("[account] anonymize", error.message);
    return { message: "Couldn't delete your account. Please contact support." };
  }
  const { error: authError } = await admin.auth.admin.deleteUser(user.id, true);
  if (authError) console.error("[account] soft delete", authError.message);

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/?notice=account-deleted");
}
