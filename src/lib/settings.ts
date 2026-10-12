import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreInfo = {
  name: string;
  legal_name: string | null;
  gstin: string | null;
  address: string | null;
  state: string;
  state_code: string | null;
  support_email: string;
  support_phone: string;
};
export type ShippingSettings = { flat_fee: number; free_above: number };
export type CodSettings = { enabled: boolean; fee: number; max_order: number };
export type CheckoutSettings = { hold_minutes: number };

export type Settings = { store: StoreInfo; shipping: ShippingSettings; cod: CodSettings; checkout: CheckoutSettings };

const DEFAULTS: Settings = {
  store: {
    name: "StarGod Perfumes",
    legal_name: "Khushify Fragrances",
    gstin: null,
    address: "Shop No. 5, Pinnacle Prestige, Tilak Rd, Pantancha Gate, Sadashiv Peth, Pune, Maharashtra 411030",
    state: "Maharashtra",
    state_code: "27",
    support_email: "hello@thestargod.com",
    support_phone: "+91 96696 61359",
  },
  shipping: { flat_fee: 7900, free_above: 99900 },
  cod: { enabled: true, fee: 4900, max_order: 500000 },
  checkout: { hold_minutes: 30 },
};

/** Store settings (server-only; settings are not readable by customers through RLS). */
export async function getSettings(): Promise<Settings> {
  const { data } = await createAdminClient().from("store_settings").select("key, value");
  const out = structuredClone(DEFAULTS) as Record<string, Record<string, unknown>>;
  for (const row of data ?? []) {
    if (row.key in out) out[row.key] = { ...out[row.key], ...(row.value as Record<string, unknown>) };
  }
  return out as unknown as Settings;
}
