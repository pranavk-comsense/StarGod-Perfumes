import { requirePermission } from "@/lib/auth/dal";
import { getSettings } from "@/lib/settings";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { serverEnv } from "@/lib/env";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/ops-forms";
import { PickupWarehouseForm } from "@/components/admin/shipmozo-forms";
import { getWarehouses, isShipmozoConfigured, type Warehouse } from "@/lib/shipping/shipmozo";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getSettings();
  const env = serverEnv();
  const shipmozo = isShipmozoConfigured();
  let warehouses: Warehouse[] | null = null;
  let shipmozoError: string | null = null;
  if (shipmozo) {
    try {
      warehouses = await getWarehouses();
    } catch (e) {
      shipmozoError = e instanceof Error ? e.message : "Couldn't reach Shipmozo";
    }
  }
  const pickup = warehouses && (env.SHIPMOZO_WAREHOUSE_ID ? warehouses.find((w) => w.id === env.SHIPMOZO_WAREHOUSE_ID) : (warehouses.find((w) => w.isDefault) ?? warehouses[0]));
  const integrations = [
    { name: "Cashfree payments", ok: isCashfreeConfigured(), hint: "CASHFREE_APP_ID, CASHFREE_SECRET_KEY" },
    { name: "Transactional email (Resend)", ok: !!env.RESEND_API_KEY, hint: "RESEND_API_KEY" },
    { name: "Shipmozo shipping", ok: shipmozo && !shipmozoError, hint: shipmozoError ?? "SHIPMOZO_PUBLIC_KEY, SHIPMOZO_PRIVATE_KEY (manual AWB entry in use)" },
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
          {shipmozo && warehouses && (
            <div className="mt-5 grid gap-3 border-t pt-4 text-sm">
              <h3 className="font-medium">Shipmozo pickup address</h3>
              {pickup ? (
                <p>
                  {pickup.title || `Warehouse ${pickup.id}`}
                  <span className="block text-xs text-muted-foreground">
                    {pickup.address} {pickup.pincode} · ID {pickup.id}
                  </span>
                </p>
              ) : (
                <p className="text-amber-700">
                  {env.SHIPMOZO_WAREHOUSE_ID ? `Warehouse ${env.SHIPMOZO_WAREHOUSE_ID} (SHIPMOZO_WAREHOUSE_ID) wasn't found.` : "No pickup address yet. Orders can't be booked until you add one."}
                </p>
              )}
              {warehouses.length > 1 && <p className="text-xs text-muted-foreground">{warehouses.length} addresses on the account. Set SHIPMOZO_WAREHOUSE_ID to choose one.</p>}
              <PickupWarehouseForm
                defaults={{
                  name: settings.store.name,
                  email: settings.store.support_email,
                  phone: settings.store.support_phone.replace(/\D/g, "").slice(-10),
                  line1: (settings.store.address ?? "").split(", Pune")[0],
                  pincode: env.SHIPMOZO_PICKUP_PINCODE,
                }}
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
