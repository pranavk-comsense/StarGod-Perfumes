/** All amounts in the app are integer paise (₹1 = 100 paise). */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 129900 -> "₹1,299". Shows paise only when present. */
export function formatINR(paise: number): string {
  return paise % 100 === 0 ? inr.format(paise / 100) : inrWithPaise.format(paise / 100);
}

/** Rupees as a decimal number, for payment-gateway APIs that take rupees (e.g. Cashfree order_amount). */
export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/** Rupee amount from a gateway (e.g. 1299.5) -> paise, without float drift. */
export function rupeesToPaise(rupees: number | string): number {
  return Math.round(Number(rupees) * 100);
}

export function discountPercent(price: number, mrp: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
