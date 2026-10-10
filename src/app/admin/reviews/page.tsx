import Link from "next/link";
import { cn } from "cn";
import { requirePermission } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/orders/format";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ReviewModeration } from "@/components/admin/ops-forms";
import { RatingStars } from "@/components/store/rating-stars";

export const metadata = { title: "Reviews" };
const TABS = ["pending", "approved", "rejected"] as const;

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePermission("reviews.moderate");
  const raw = (await searchParams).status;
  const status = TABS.find((t) => t === raw) ?? "pending";
  const { data: reviews } = await createAdminClient()
    .from("reviews")
    .select("id, rating, title, body, status, is_verified, created_at, products(name, slug), profiles(full_name, email)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <AdminPageHeader title="Reviews" description="New reviews appear on the store after approval." />
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/reviews?status=${t}`} className={cn("rounded-full border px-3.5 py-1.5 text-xs capitalize", t === status ? "bg-primary text-primary-foreground" : "bg-card")}>
            {t}
          </Link>
        ))}
      </div>
      {reviews && reviews.length > 0 ? (
        <ul className="grid gap-3">
          {reviews.map((r) => {
            const product = r.products as { name: string; slug: string } | null;
            const author = r.profiles as { full_name: string | null; email: string | null } | null;
            return (
              <li key={r.id} className="flex flex-wrap justify-between gap-4 rounded-md border bg-card p-5">
                <div className="min-w-0 max-w-2xl text-sm">
                  <div className="flex items-center gap-2">
                    <RatingStars value={r.rating} />
                    <span className="text-xs text-muted-foreground">on</span>
                    <Link href={`/products/${product?.slug}`} target="_blank" className="font-medium hover:underline">
                      {product?.name}
                    </Link>
                    {r.is_verified && <span className="text-xs text-success">✓ Verified buyer</span>}
                  </div>
                  {r.title && <p className="mt-2 font-medium">{r.title}</p>}
                  {r.body && <p className="mt-1 text-muted-foreground">{r.body}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {author?.full_name ?? "—"} · {author?.email} · {formatDateTime(r.created_at)}
                  </p>
                </div>
                <ReviewModeration reviewId={r.id} status={r.status} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">No {status} reviews.</p>
      )}
    </>
  );
}
