import { requirePermission } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { serverEnv } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/ops-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();
  const env = serverEnv();
  const integrations = [
    { name: "Cashfree payments", ok: isCashfreeConfigured(), hint: "CASHFREE_APP_ID, CASHFREE_SECRET_KEY" },
    { name: "Transactional email (Resend)", ok: !!env.RESEND_API_KEY, hint: "RESEND_API_KEY" },
    { name: "Shipmozo shipping", ok: false, hint: "Waiting for API docs; manual AWB entry in use" },
    { name: "Scheduled jobs", ok: !!env.CRON_SECRET, hint: "CRON_SECRET" },
  ];

  return (
    <>
      <AdminPageHeader title="Settings" />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-md border bg-card p-5 sm:p-6">
          <SettingsForm settings={settings} />
        </section>
        <section className="h-fit rounded-md border bg-card p-5">
          <h2 className="mb-3 font-sans text-base font-medium">Integrations</h2>
          <ul className="grid gap-3 text-sm">
            {integrations.map((i) => (
              <li key={i.name} className="flex gap-2">
                <span className={i.ok ? "text-success" : "text-amber-600"}>{i.ok ? "●" : "○"}</span>
                <span>
                  {i.name}
                  <span className="block text-xs text-muted-foreground">{i.ok ? "Connected" : `Not configured: ${i.hint}`}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
