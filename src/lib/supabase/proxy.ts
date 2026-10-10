import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_PREFIXES = ["/account", "/checkout", "/admin"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

/**
 * Refreshes the Supabase session cookie on every request and does an
 * optimistic redirect for signed-out users on protected routes. Real
 * authorisation (incl. admin role) is enforced again in each page/action.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  // Do not add code between client creation and getClaims(); it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const redirectTo = (path: string, query = "") => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = query;
    const redirect = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  };

  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirectTo("/login", `?next=${encodeURIComponent(pathname + search)}`);
  }
  // Back office: non-staff get a real 404 status (the admin layout re-checks authoritatively).
  if (signedIn && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data!.claims!.sub).maybeSingle();
    if (profile?.role !== "staff" && profile?.role !== "admin") {
      return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
    }
  }
  // Already signed in: no need for the sign-in pages. (Role-specific routing happens in the app.)
  if (signedIn && GUEST_ONLY.includes(pathname)) {
    return redirectTo("/");
  }
  // The reset form needs the recovery session created by the emailed link.
  if (!signedIn && pathname === "/reset-password") {
    return redirectTo("/forgot-password", "?notice=link-expired");
  }

  return response;
}
