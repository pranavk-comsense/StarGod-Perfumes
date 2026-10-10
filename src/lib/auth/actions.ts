"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/dal";
import { postAuthRedirect, safeNext } from "@/lib/auth/roles";
import { RECOVERY_COOKIE } from "@/lib/auth/constants";
import {
  changePasswordSchema,
  emailOnlySchema,
  fieldErrors,
  formValues,
  profileSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type FormState,
} from "@/lib/validation/auth";

const GENERIC_ERROR = "Something went wrong. Please try again.";

function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "weak_password":
      return "That password is too weak. Use 8+ characters with upper and lower case letters and a number.";
    case "same_password":
      return "Your new password must be different from the old one.";
    case "email_address_invalid":
      return "Enter a valid email address.";
    case "signup_disabled":
      return "Sign-ups are temporarily closed.";
    case "validation_failed":
      return "Please check the details you entered.";
    default:
      console.error("[auth]", error.code, error.message);
      return GENERIC_ERROR;
  }
}

async function roleOf(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role ?? "customer";
}

// -----------------------------------------------------------------------------
// Sign in / sign up
// -----------------------------------------------------------------------------

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        message: "Please confirm your email before signing in. Check your inbox for the link.",
        unverifiedEmail: parsed.data.email,
        values,
      };
    }
    if (error.code === "invalid_credentials") {
      return { message: "Incorrect email or password.", values };
    }
    return { message: authErrorMessage(error), values };
  }

  redirect(postAuthRedirect(await roleOf(data.user.id), formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { fullName, email, phone, password, marketing } = parsed.data;
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      data: {
        full_name: fullName,
        phone: phone ?? "",
        terms_accepted: true,
        marketing_opt_in: marketing === "on",
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: [authErrorMessage(error)] }, values };
    }
    return { message: authErrorMessage(error), values };
  }

  // Same response whether or not the email was already registered (no account enumeration).
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function resendVerification(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data.email });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { message: authErrorMessage(error) };
  }
  return { ok: true, message: "If that account still needs confirming, we've sent a new link." };
}

export async function signInWithGoogle(_prev: FormState, formData: FormData): Promise<FormState> {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    console.error("[auth] google", error?.code, error?.message);
    return { message: "Google sign-in isn't available right now. Please use email and password." };
  }
  redirect(data.url);
}

// -----------------------------------------------------------------------------
// Password reset
// -----------------------------------------------------------------------------

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/reset-password`,
  });
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { message: authErrorMessage(error), values };
  }
  if (error) console.error("[auth] reset", error.code, error.message);

  // Never reveal whether the email has an account.
  return {
    ok: true,
    message: `If an account exists for ${parsed.data.email}, we've emailed a link to reset your password. It expires in 1 hour.`,
  };
}

/** Sets a new password using the recovery session created by the emailed link. */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const cookieStore = await cookies();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub || cookieStore.get(RECOVERY_COOKIE)?.value !== "1") {
    return { message: "Your reset link has expired. Please request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") {
      return { fieldErrors: { password: [authErrorMessage(error)] } };
    }
    return { message: authErrorMessage(error) };
  }

  cookieStore.delete(RECOVERY_COOKIE);
  // Anyone else holding a session (e.g. whoever knew the old password) is signed out.
  await supabase.auth.signOut({ scope: "others" });
  const target = postAuthRedirect(await roleOf(claims.claims.sub));
  redirect(`${target}${target.includes("?") ? "&" : "?"}notice=password-updated`);
}

// -----------------------------------------------------------------------------
// Signed-in account management
// -----------------------------------------------------------------------------

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user?.email) return { message: "Please sign in again." };

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  // Re-authenticate with the current password (also satisfies secure_password_change).
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (authError) {
    return { fieldErrors: { currentPassword: ["Your current password is incorrect"] } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password" || error.code === "same_password") {
      return { fieldErrors: { password: [authErrorMessage(error)] } };
    }
    return { message: authErrorMessage(error) };
  }
  await supabase.auth.signOut({ scope: "others" });
  return { ok: true, message: "Password updated. Other devices have been signed out." };
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { message: "Please sign in again." };

  const values = formValues(formData);
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      marketing_opt_in: parsed.data.marketing === "on",
    })
    .eq("id", user.id);
  if (error) {
    console.error("[profile]", error.message);
    return { message: GENERIC_ERROR, values };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved.", values };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/?notice=signed-out");
}

export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?notice=signed-out-everywhere");
}
