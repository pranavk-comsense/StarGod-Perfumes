import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/**
 * Fixed-window limiter backed by Postgres (shared by all serverless instances).
 * Returns true when the call is allowed. Fails open if the DB call errors, so a
 * limiter outage never blocks checkout.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) {
    console.error("[rate-limit]", error.message);
    return true;
  }
  return data === true;
}
