import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRates, isShipmozoConfigured } from "@/lib/shipping/shipmozo";

/**
 * Shipping provider boundary for the storefront pincode check. With Shipmozo
 * keys set, serviceability comes from Shipmozo's courier rates (cached per
 * pincode); otherwise, or if Shipmozo is unreachable, it falls back to an estimate.
 * Booking, labels, tracking and cancellation live in @/lib/shipping/shipmozo.
 */
export type Serviceability = {
  pincode: string;
  serviceable: boolean;
  codAvailable: boolean;
  etaDays: [number, number];
  /** false = an estimate, not a confirmed courier response */
  confirmed: boolean;
};

export interface ShippingProvider {
  name: string;
  checkServiceability(pincode: string): Promise<Serviceability>;
}

// Major metro PIN prefixes → faster estimate.
const METRO_PREFIXES = ["110", "400", "560", "600", "700", "500", "411", "380", "122", "201"];

export const manualProvider: ShippingProvider = {
  name: "manual",
  async checkServiceability(pincode) {
    const metro = METRO_PREFIXES.some((p) => pincode.startsWith(p));
    return { pincode, serviceable: true, codAvailable: true, etaDays: metro ? [2, 4] : [4, 7], confirmed: false };
  },
};

const CACHE_HOURS = 72;
// A typical single-bottle parcel; the real parcel is rated when the order is booked.
const PROBE_PARCEL = { weightG: 500, lengthCm: 15, widthCm: 10, heightCm: 10 };

export const shipmozoProvider: ShippingProvider = {
  name: "shipmozo",
  async checkServiceability(pincode) {
    const db = createAdminClient();
    const { data: cached } = await db.from("pincode_cache").select("serviceable, cod_available, eta_days, checked_at").eq("pincode", pincode).maybeSingle();
    if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_HOURS * 3600_000) {
      return toResult(pincode, cached.serviceable, cached.cod_available, cached.eta_days);
    }

    try {
      const probe = (paymentType: "COD" | "PREPAID") =>
        getRates({ pickupPincode: serverEnv().SHIPMOZO_PICKUP_PINCODE, deliveryPincode: pincode, paymentType, orderAmount: 150000, parcel: PROBE_PARCEL });
      const cod = await probe("COD");
      const rates = cod.length > 0 ? cod : await probe("PREPAID");
      const eta = rates.map((r) => r.etaDays).filter((d): d is number => d !== null);
      const etaDays = eta.length ? Math.min(...eta) : null;
      await db.from("pincode_cache").upsert({ pincode, serviceable: rates.length > 0, cod_available: cod.length > 0, eta_days: etaDays, checked_at: new Date().toISOString() });
      return toResult(pincode, rates.length > 0, cod.length > 0, etaDays);
    } catch (e) {
      console.error("[shipmozo] serviceability", pincode, e);
      return manualProvider.checkServiceability(pincode);
    }
  },
};

function toResult(pincode: string, serviceable: boolean, codAvailable: boolean, etaDays: number | null): Serviceability {
  const eta = etaDays ?? 5;
  // Courier ETAs exclude packing time, so add a day and give a range.
  return { pincode, serviceable, codAvailable, etaDays: [eta + 1, eta + 3], confirmed: true };
}

export function shippingProvider(): ShippingProvider {
  return isShipmozoConfigured() ? shipmozoProvider : manualProvider;
}
