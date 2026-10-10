-- Approved reviews with a privacy-safe author name ("Aarav M."). Profiles are
-- not publicly readable, so this view runs with its owner's rights and exposes
-- only the columns below.
create view public.public_reviews
with (security_barrier = true)
as
select
  r.id,
  r.product_id,
  p.slug  as product_slug,
  p.name  as product_name,
  r.rating,
  r.title,
  r.body,
  r.is_verified,
  r.created_at,
  coalesce(
    nullif(trim(split_part(pr.full_name, ' ', 1) ||
      case when split_part(pr.full_name, ' ', 2) <> '' then ' ' || left(split_part(pr.full_name, ' ', 2), 1) || '.' else '' end), ''),
    'Verified customer') as author_name
from public.reviews r
join public.products p on p.id = r.product_id and p.is_active
left join public.profiles pr on pr.id = r.user_id
where r.status = 'approved';

revoke all on public.public_reviews from anon, authenticated;
grant select on public.public_reviews to anon, authenticated;
