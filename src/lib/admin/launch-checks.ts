import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv, serverEnv } from "@/lib/env";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { isShipmozoConfigured } from "@/lib/shipping/shipmozo";
import { getSettings } from "@/lib/settings";

export type LaunchCheck = { label: string; ok: boolean; hint: string; blocker: boolean };

/**
 * Production-readiness checks for the deployment this code runs on (env vars
 * live in Vercel, data in the hosted project), shown on the admin dashboard.
 */
export async function getLaunchChecks(): Promise<LaunchCheck[]> {
  const env = serverEnv();
  const pub = publicEnv();
  const admin = createAdminClient();
  const site = new URL(pub.NEXT_PUBLIC_SITE_URL);

  const [demo, latestMigration, settings] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }).like("email", "%@stargod.test"),
    admin.from("return_shipments").select("id", { count: "exact", head: true }),
    getSettings(),
  ]);

  return [
    {
      label: "No demo accounts",
      ok: !demo.error && demo.count === 0,
      hint: `${demo.count ?? "Unknown number of"} @stargod.test account(s) with the public password Password@123 exist. Run the cleanup block in supabase/prod_demo_accounts.sql.`,
      blocker: true,
    },
    {
      label: "Database migrations applied",
      ok: !latestMigration.error,
      hint: "The latest migration (Shipmozo returns) is missing. Run `supabase db push` against this project.",
      blocker: true,
    },
    {
      label: "Site URL",
      ok: site.protocol === "https:" && !["localhost", "127.0.0.1"].includes(site.hostname),
      hint: `NEXT_PUBLIC_SITE_URL is ${site.origin}. Set it to the live https domain (used for payment return and webhook URLs).`,
      blocker: true,
    },
    {
      label: "Online payments (Cashfree)",
      ok: isCashfreeConfigured() && pub.NEXT_PUBLIC_CASHFREE_MODE === "production",
      hint: isCashfreeConfigured()
        ? "NEXT_PUBLIC_CASHFREE_MODE is sandbox: customers can't pay for real."
        : "CASHFREE_APP_ID / CASHFREE_SECRET_KEY are not set: only Cash on Delivery is offered.",
      blocker: true,
    },
    {
      label: "Order emails (Resend)",
      ok: Boolean(env.RESEND_API_KEY),
      hint: "RESEND_API_KEY is not set: order and refund emails are only logged, customers receive nothing.",
      blocker: true,
    },
    {
      label: "Scheduled jobs",
      ok: Boolean(env.CRON_SECRET),
      hint: "CRON_SECRET is not set: stock-hold expiry, refund polling and shipment sync never run.",
      blocker: true,
    },
    {
      label: "Courier integration (Shipmozo)",
      ok: isShipmozoConfigured(),
      hint: "Shipmozo keys are not set: staff must enter courier and AWB by hand, and pincode checks are estimates.",
      blocker: false,
    },
    {
      label: "Invoice details",
      ok: Boolean(settings.store.address && settings.store.gstin),
      hint: "Add the registered address (and GSTIN, if GST-registered) in Settings so invoices are complete.",
      blocker: false,
    },
  ];
}
