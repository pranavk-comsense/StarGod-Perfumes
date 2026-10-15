import { z } from "zod";

/**
 * Public env (inlined into the client bundle at build time, so each variable
 * must be referenced literally as process.env.NEXT_PUBLIC_*).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_CASHFREE_MODE: z.enum(["sandbox", "production"]).default("sandbox"),
});

/** Server-only env. Optional entries belong to integrations built in later phases. */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  CASHFREE_APP_ID: z.string().min(1).optional(),
  CASHFREE_SECRET_KEY: z.string().min(1).optional(),
  CASHFREE_API_VERSION: z.string().default("2025-01-01"),
  SHIPMOZO_PUBLIC_KEY: z.string().min(1).optional(),
  SHIPMOZO_PRIVATE_KEY: z.string().min(1).optional(),
  /** Pickup warehouse; defaults to the account's default (or first) warehouse. */
  SHIPMOZO_WAREHOUSE_ID: z.string().min(1).optional(),
  SHIPMOZO_PICKUP_PINCODE: z.string().regex(/^[1-9][0-9]{5}$/).default("411030"),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("StarGod Perfumes <orders@thestargod.com>"),
  ADMIN_NOTIFICATION_EMAIL: z.email().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError) {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

let publicCache: PublicEnv | undefined;
export function publicEnv(): PublicEnv {
  if (publicCache) return publicCache;
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CASHFREE_MODE: process.env.NEXT_PUBLIC_CASHFREE_MODE || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment variables (see .env.example):\n${format(parsed.error)}`);
  }
  return (publicCache = parsed.data);
}

let serverCache: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (serverCache) return serverCache;
  const parsed = serverSchema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) {
    throw new Error(`Invalid server environment variables (see .env.example):\n${format(parsed.error)}`);
  }
  return (serverCache = parsed.data);
}
