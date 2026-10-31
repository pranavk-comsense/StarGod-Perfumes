import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { syncOrderPayment } from "@/lib/payments/sync";

export type HoldSweepResult = { checked: number; paid: number; expired: number; errors: number };

/**
 * Releases stock held by unpaid prepaid orders whose hold has expired. Before
 * expiring an order we ask Cashfree whether it was paid (a webhook may have been
 * missed), so a paid order is never cancelled; a payment that lands after expiry
 * is still handled by mark_order_paid (re-reserve or flag for refund).
 *
 * Used by the daily cron, and on demand at checkout (`variantIds`) when a
 * shopper hits a stock problem, so abandoned payments don't keep the last units
 * locked until the next cron run.
 */
export async function releaseExpiredHolds(opts: { variantIds?: string[]; limit?: number } = {}): Promise<HoldSweepResult> {
  const supabase = createAdminClient();
  const graceCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  let query = supabase
    .from("orders")
    .select(opts.variantIds ? "id, order_number, order_items!inner(variant_id)" : "id, order_number")
    .eq("status", "pending_payment")
    .lt("reserved_until", graceCutoff)
    .order("reserved_until")
    .limit(opts.limit ?? 50);
  if (opts.variantIds) query = query.in("order_items.variant_id", opts.variantIds);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load expired holds: ${error.message}`);
  const orders = (data ?? []) as unknown as { id: string; order_number: string }[];

  const result: HoldSweepResult = { checked: orders.length, paid: 0, expired: 0, errors: 0 };
  for (const o of orders) {
    try {
      if (isCashfreeConfigured()) {
        const r = await syncOrderPayment(o.order_number, "cron");
        if (r === "paid" || r === "already_paid" || r === "needs_refund" || r === "amount_mismatch") {
          result.paid++;
          continue;
        }
        if (r === "pending") continue; // payment in flight; check again next run
      }
      const { data: expired } = await supabase.rpc("expire_order_hold", { p_order_id: o.id });
      if (expired) result.expired++;
    } catch (e) {
      result.errors++;
      console.error("[holds] expire", o.order_number, e);
    }
  }
  // Released stock: let cached product pages stop showing "Sold out".
  if (result.expired > 0) revalidateTag(CATALOG_TAG, "max");
  return result;
}

/** Checkout helper: true when at least one hold on these variants was released. Never throws. */
export async function releaseExpiredHoldsFor(variantIds: string[]): Promise<boolean> {
  if (!variantIds.length) return false;
  try {
    const r = await releaseExpiredHolds({ variantIds, limit: 5 });
    return r.expired > 0;
  } catch (e) {
    console.error("[holds] on-demand release", e);
    return false;
  }
}
