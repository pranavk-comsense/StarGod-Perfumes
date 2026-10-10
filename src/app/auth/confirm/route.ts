import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { postAuthRedirect, safeNext } from "@/lib/auth/roles";
import { RECOVERY_COOKIE } from "@/lib/auth/constants";

const TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

/**
 * Landing point for every emailed auth link. Supports both link formats:
 *  - custom templates (supabase/templates/*.html): ?token_hash=…&type=…
 *  - Supabase default templates (PKCE): Supabase verifies the link, then
 *    redirects here with ?code=… (plus the type/next we put in redirectTo).
 * Either way a session cookie is created, then the user is routed on.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const rawType = searchParams.get("type");
  const type = TYPES.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
  const next = searchParams.get("next");

  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  const expired = () => to(type === "recovery" ? "/forgot-password?notice=link-expired" : "/login?notice=link-expired");

  const supabase = await createClient();
  let userId: string | undefined;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error || !data.user) return expired();
    userId = data.user.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return expired();
    userId = data.user.id;
  } else {
    // Supabase reports link errors (expired / already used) in the query string.
    return searchParams.get("error") ? expired() : to("/login?notice=link-invalid");
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

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const target = postAuthRedirect(profile?.role, safeNext(next));
  return to(`${target}${target.includes("?") ? "&" : "?"}notice=email-confirmed`);
}
