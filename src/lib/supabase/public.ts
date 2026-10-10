import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createClient<Database>> | undefined;

/**
 * Cookieless anon client for public catalog reads (RLS applies as `anon`).
 * Because it doesn't touch the request, it is safe to use inside "use cache"
 * functions; pair those with cacheTag() so admin edits can revalidate them.
 */
export function createPublicClient() {
  if (client) return client;
  const env = publicEnv();
  client = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
