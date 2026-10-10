import Link from "next/link";
import { requirePermission } from "@/lib/auth/dal";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CouponForm } from "@/components/admin/ops-forms";

export const metadata = { title: "New coupon" };

export default async function NewCouponPage() {
  await requirePermission("coupons.manage");
  return (
    <>
      <Link href="/admin/coupons" className="text-xs text-muted-foreground hover:text-foreground">
        ← Coupons
      </Link>
      <AdminPageHeader title="New coupon" />
      <section className="max-w-3xl rounded-md border bg-card p-5 sm:p-6">
        <CouponForm />
      </section>
    </>
  );
}
