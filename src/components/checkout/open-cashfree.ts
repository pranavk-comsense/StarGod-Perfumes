"use client";

/** Opens Cashfree's hosted checkout in the same tab; Cashfree redirects back to /checkout/return. */
export async function openCashfreeCheckout(paymentSessionId: string, mode: "sandbox" | "production") {
  const { load } = await import("@cashfreepayments/cashfree-js");
  const cashfree = await load({ mode });
  if (!cashfree) throw new Error("Cashfree SDK failed to load");
  const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
  if (result?.error) throw new Error(result.error.message);
}
