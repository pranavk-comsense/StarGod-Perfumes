import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Activity log" };

export default async function ActivityPage() {
  await requirePermission("settings.manage");
  const { data: rows } = await createAdminClient()
    .from("admin_audit_log")
    .select("id, action, entity, entity_id, details, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <AdminPageHeader title="Activity log" description="Who changed what in the back office: prices, stock, refunds, roles and settings." />
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">When</th>
              <th className="px-5 py-3 font-medium">Who</th>
              <th className="px-5 py-3 font-medium">Action</th>
              <th className="px-5 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(rows ?? []).map((r) => {
              const who = r.profiles as { full_name: string | null; email: string | null } | null;
              return (
                <tr key={r.id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                  <td className="px-5 py-3">{who?.full_name ?? who?.email ?? "System"}</td>
                  <td className="px-5 py-3 font-medium">{r.action}</td>
                  <td className="max-w-md px-5 py-3">
                    <code className="line-clamp-3 break-all text-xs text-muted-foreground">{r.details ? JSON.stringify(r.details) : r.entity_id}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(!rows || rows.length === 0) && <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>}
      </div>
    </>
  );
}
