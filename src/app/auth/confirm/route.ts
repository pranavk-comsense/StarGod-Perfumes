import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { postAuthRedirect, safeNext } from "@/lib/auth/roles";
import { RECOVERY_COOKIE } from "@/lib/auth/constants";

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

/**
 * Landing point for every emailed auth link (see supabase/templates/*.html):
 * verifies the one-time token_hash, which creates the session cookie, then
 * routes the user on.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!tokenHash || !type || !TYPES.includes(type)) {
    return to("/login?notice=link-invalid");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data.user) {
    return to(type === "recovery" ? "/forgot-password?notice=link-expired" : "/login?notice=link-expired");
  }

  if (type === "recovery") {
    // Marks this browser as having come from a recovery link; updatePassword() requires it,
    // so an ordinary signed-in session can't change the password without the current one.
    const res = to("/reset-password");
    res.cookies.set(RECOVERY_COOKIE, "1", {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60,
    });
    return res;
  }
  if (type === "email_change") return to("/account/profile?notice=email-updated");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  const target = postAuthRedirect(profile?.role, safeNext(next));
  return to(`${target}${target.includes("?") ? "&" : "?"}notice=email-confirmed`);
}
