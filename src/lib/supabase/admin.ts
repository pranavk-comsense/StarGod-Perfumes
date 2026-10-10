import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Service-role client. BYPASSES RLS, so use it only on the server, only after
 * the caller has been authenticated/authorised, and only for operations that
 * clients may not perform themselves (orders, payments, refunds, webhooks).
 */
export function createAdminClient() {
  if (client) return client;
  client = createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
