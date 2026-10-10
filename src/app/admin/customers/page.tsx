import { requirePermission } from "@/lib/auth/dal";
import { can, ROLE_LABELS } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RoleSelect } from "@/components/admin/role-select";

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage() {
  const user = await requirePermission("customers.view");
  const canManageRoles = can(user.role, "users.manage_roles");

  const supabase = await createClient();
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, created_at, marketing_opt_in")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <>
      <AdminPageHeader
        title="Customers & team"
        description={canManageRoles ? "Promote trusted team members to Staff (operations) or Admin (full access)." : "Read-only for staff."}
      />
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Contact</th>
              <th className="px-5 py-3 font-medium">Joined</th>
              <th className="px-5 py-3 font-medium">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(people ?? []).map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3">
                  <p className="font-medium">{p.full_name || "—"}</p>
                  {p.marketing_opt_in && <p className="text-xs text-muted-foreground">Subscribed to emails</p>}
                </td>
                <td className="px-5 py-3">
                  <p>{p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.phone ?? ""}</p>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                <td className="px-5 py-3">
                  {canManageRoles ? (
                    <RoleSelect userId={p.id} role={p.role} disabled={p.id === user.id} />
                  ) : (
                    <span>{ROLE_LABELS[p.role]}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
