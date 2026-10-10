import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/components/admin/ops-forms";

export const metadata = { title: "Edit coupon" };

export default async function EditCouponPage({ params }: PageProps<"/admin/coupons/[id]">) {
  await requirePermission("coupons.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: coupon } = await createAdminClient().from("coupons").select("*").eq("id", id).maybeSingle();
  if (!coupon) notFound();
  return (
    <>
      <Link href="/admin/coupons" className="text-xs text-muted-foreground hover:text-foreground">
        ← Coupons
      </Link>
      <AdminPageHeader title={coupon.code} description={`Used ${coupon.used_count} time${coupon.used_count === 1 ? "" : "s"}`} />
      <section className="max-w-3xl rounded-md border bg-card p-5 sm:p-6">
        <CouponForm coupon={coupon} />
      </section>
    </>
  );
}
