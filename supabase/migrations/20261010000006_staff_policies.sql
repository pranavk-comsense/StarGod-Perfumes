-- =============================================================================
-- Staff role: operations access (orders, shipments, reviews, inventory).
-- Kept separate from the enum change because a new enum value can't be used
-- in the same transaction that adds it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profile consent fields (DPDP: record when terms were accepted)
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column marketing_opt_in   boolean not null default false,
  add column terms_accepted_at  timestamptz;

grant update (marketing_opt_in) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name, marketing_opt_in, terms_accepted_at)
  values (
    new.id,
    new.email,
    coalesce(new.phone, nullif(new.raw_user_meta_data ->> 'phone', '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    case when (new.raw_user_meta_data ->> 'terms_accepted')::boolean then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Role helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('staff', 'admin')
  );
$$;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Admin audit log
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,              -- e.g. 'user.role_changed', 'refund.created', 'product.updated'
  entity      text,                       -- e.g. 'profile', 'order', 'product'
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
create policy "audit: admin read" on public.admin_audit_log
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

-- Change a user's role. Server-only: the app checks the caller is an admin first.
create or replace function public.set_user_role(p_actor uuid, p_target uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.user_role;
begin
  select role into v_old from public.profiles where id = p_target for update;
  if v_old is null then
    raise exception 'USER_NOT_FOUND';
  end if;
  if p_actor = p_target then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;
  if v_old = p_role then
    return;
  end if;
  if v_old = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  update public.profiles set role = p_role where id = p_target;
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, 'user.role_changed', 'profile', p_target::text,
          jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;
revoke execute on function public.set_user_role(uuid, uuid, public.user_role) from public, anon, authenticated;
grant execute on function public.set_user_role(uuid, uuid, public.user_role) to service_role;

-- -----------------------------------------------------------------------------
-- Widen operational read/moderation policies from admin to staff.
-- Products, prices, coupons, refunds, settings and payments stay admin-only.
-- -----------------------------------------------------------------------------
drop policy "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_staff()));

drop policy "addresses: admin read" on public.addresses;
create policy "addresses: staff read" on public.addresses
  for select to authenticated using ((select public.is_staff()));

drop policy "orders: owner read" on public.orders;
create policy "orders: owner read" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy "order_items: owner read" on public.order_items;
create policy "order_items: owner read" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));

drop policy "order_status_history: owner read" on public.order_status_history;
create policy "order_status_history: owner read" on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));

drop policy "shipments: owner read" on public.shipments;
create policy "shipments: owner read" on public.shipments
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));

drop policy "shipment_events: owner read" on public.shipment_events;
create policy "shipment_events: owner read" on public.shipment_events
  for select to authenticated using (
    exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id
             where s.id = shipment_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));

drop policy "refunds: owner read" on public.refunds;
create policy "refunds: owner read" on public.refunds
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_staff()))));

drop policy "inventory_movements: admin read" on public.inventory_movements;
create policy "inventory_movements: staff read" on public.inventory_movements
  for select to authenticated using ((select public.is_staff()));

-- Staff moderate reviews (and see all of them, incl. pending)
create policy "reviews: staff read" on public.reviews
  for select to authenticated using ((select public.is_staff()));
create policy "reviews: staff moderate" on public.reviews
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Staff can see inactive catalog rows (needed for order/inventory screens)
create policy "products: staff read" on public.products
  for select to authenticated using ((select public.is_staff()));
create policy "variants: staff read" on public.product_variants
  for select to authenticated using ((select public.is_staff()));

-- The moderation trigger must treat staff like admins.
create or replace function public.reviews_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_verified := exists (
    select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
     where o.user_id = new.user_id
       and oi.product_id = new.product_id
       and o.status = 'delivered'
  );
  if (select auth.uid()) is not null and not public.is_staff() then
    if tg_op = 'INSERT'
       or (new.rating, new.title, new.body) is distinct from (old.rating, old.title, old.body) then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.reviews_before_write() from public, anon, authenticated;
