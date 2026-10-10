import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCashfreeConfigured } from "@/lib/payments/cashfree";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/store/status-badge";

export const metadata = { title: "Refunds" };

export default async function RefundsPage() {
  await requirePermission("refunds.manage");
  const admin = createAdminClient();
  const [{ data: flagged }, { data: refunds }] = await Promise.all([
    admin.from("orders").select("id, order_number, status, total, admin_note, created_at").eq("needs_refund", true).order("created_at"),
    admin.from("refunds").select("id, refund_id, amount, status, reason, initiated_by, created_at, processed_at, orders(id, order_number)").order("created_at", { ascending: false }).limit(100),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Refunds"
        description={isCashfreeConfigured() ? "Refunds are sent to Cashfree and confirmed by webhook." : "Cashfree isn't configured: refunds are recorded as pending until keys are added."}
      />
      <section className="mb-6 rounded-md border bg-card">
        <h2 className="border-b px-5 py-4 font-sans text-base font-medium">Needs attention ({flagged?.length ?? 0})</h2>
        {flagged && flagged.length > 0 ? (
          <ul className="divide-y text-sm">
            {flagged.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:underline">
                    {o.order_number}
                  </Link>
                  {o.admin_note && <p className="max-w-xl whitespace-pre-line text-xs text-muted-foreground">{o.admin_note}</p>}
                </div>
                <OrderStatusBadge status={o.status} />
                <span>{formatINR(o.total)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing waiting for a refund.</p>
        )}
      </section>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Refund</th>
              <th className="px-5 py-3 font-medium">Order</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(refunds ?? []).map((r) => {
              const o = r.orders as { id: string; order_number: string } | null;
              return (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    {r.refund_id}
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/orders/${o?.id}`} className="hover:underline">
                      {o?.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{r.reason}</td>
                  <td className="px-5 py-3 capitalize">{r.status}</td>
                  <td className="px-5 py-3 text-right font-medium">{formatINR(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!refunds || refunds.length === 0) && <p className="p-8 text-center text-sm text-muted-foreground">No refunds yet.</p>}
      </div>
    </>
  );
}
