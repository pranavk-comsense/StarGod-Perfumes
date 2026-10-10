import "server-only";

/**
 * Shipping provider boundary. Today only the "manual" provider exists: staff
 * enter the courier + AWB, and pincode checks return an estimate.
 * The Shipmozo implementation (rates, AWB, pickup, label, tracking, cancel)
 * will implement this interface once its API documentation is provided.
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

export function shippingProvider(): ShippingProvider {
  return manualProvider;
}
