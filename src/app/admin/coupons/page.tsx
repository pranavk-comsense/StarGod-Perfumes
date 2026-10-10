import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requirePermission("coupons.manage");
  const { data: coupons } = await createAdminClient().from("coupons").select("*").order("created_at", { ascending: false });

  return (
    <>
      <AdminPageHeader title="Coupons">
        <Link href="/admin/coupons/new" className={buttonVariants()}>
          <PlusIcon /> New coupon
        </Link>
      </AdminPageHeader>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Rules</th>
              <th className="px-5 py-3 font-medium">Used</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(coupons ?? []).map((c) => {
              const expired = c.ends_at && new Date(c.ends_at) < new Date();
              return (
                <tr key={c.id}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/coupons/${c.id}`} className="font-medium hover:underline">
                      {c.code}
                    </Link>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    {c.type === "percent" ? `${c.value}%${c.max_discount ? ` (max ${formatINR(c.max_discount)})` : ""}` : c.type === "flat" ? formatINR(c.value) : "Free shipping"}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {c.min_order ? `Min ${formatINR(c.min_order)} · ` : ""}
                    {c.per_user_limit}/customer{c.first_order_only ? " · first order" : ""}
                    {c.ends_at ? ` · ends ${formatDate(c.ends_at)}` : ""}
                  </td>
                  <td className="px-5 py-3">
                    {c.used_count}
                    {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                  </td>
                  <td className="px-5 py-3">{!c.is_active ? <span className="text-muted-foreground">Off</span> : expired ? <span className="text-muted-foreground">Expired</span> : <span className="text-success">Active</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
