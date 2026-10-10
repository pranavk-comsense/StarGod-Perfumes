import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postAuthRedirect } from "@/lib/auth/roles";

/** OAuth (Google) return URL: exchanges the PKCE code for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!code) return to("/login?notice=oauth-failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    console.error("[auth] oauth callback", error?.code, error?.message);
    return to("/login?notice=oauth-failed");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return to(postAuthRedirect(profile?.role, searchParams.get("next")));
}
