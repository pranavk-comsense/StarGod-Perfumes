-- =============================================================================
-- Operations: stock adjustments, manual shipments, rate limiting, account
-- anonymisation (DPDP) and an audit helper. All server-only (service_role).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit helper
-- -----------------------------------------------------------------------------
create or replace function public.audit(p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_log (actor_id, action, entity, entity_id, details)
  values (p_actor, p_action, p_entity, p_entity_id, p_details);
$$;

-- -----------------------------------------------------------------------------
-- Stock adjustment (restock / correction). Never lets stock go negative.
-- -----------------------------------------------------------------------------
create or replace function public.adjust_stock(p_variant_id uuid, p_delta int, p_reason text, p_actor uuid, p_note text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new int;
begin
  if p_delta = 0 then
    raise exception 'INVALID_DELTA';
  end if;
  if p_reason not in ('restock', 'adjust') then
    raise exception 'INVALID_REASON';
  end if;

  update public.product_variants
     set stock = stock + p_delta
   where id = p_variant_id and stock + p_delta >= 0
  returning stock into v_new;
  if v_new is null then
    raise exception 'STOCK_WOULD_GO_NEGATIVE';
  end if;

  insert into public.inventory_movements (variant_id, delta, reason, actor)
  values (p_variant_id, p_delta, p_reason, p_actor::text);
  perform public.audit(p_actor, 'inventory.adjusted', 'variant', p_variant_id::text,
                       jsonb_build_object('delta', p_delta, 'reason', p_reason, 'note', p_note, 'new_stock', v_new));
  return v_new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Manual shipments (used until the Shipmozo integration is connected; the
-- integration will call the same function with provider='shipmozo').
-- -----------------------------------------------------------------------------
create or replace function public.create_shipment(
  p_order_id      uuid,
  p_provider      text,
  p_courier_name  text,
  p_awb           text,
  p_tracking_url  text,
  p_actor         text,
  p_raw           jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.order_status;
  v_id uuid;
begin
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_status not in ('confirmed', 'processing') then
    raise exception 'NOT_SHIPPABLE';
  end if;

  insert into public.shipments (order_id, provider, awb, courier_name, tracking_url, status, raw)
  values (p_order_id, p_provider, nullif(trim(p_awb), ''), p_courier_name, nullif(trim(p_tracking_url), ''), 'shipped', p_raw)
  returning id into v_id;

  insert into public.shipment_events (shipment_id, status, description, occurred_at)
  values (v_id, 'shipped', format('Handed over to %s', p_courier_name), now());

  perform public.set_order_status(p_order_id, 'shipped', p_actor, format('Shipped via %s, AWB %s', p_courier_name, p_awb));
  return v_id;
end;
$$;

-- Tracking update (manual or from the courier). Moves the order along for terminal events.
create or replace function public.add_shipment_event(
  p_shipment_id  uuid,
  p_status       text,
  p_location     text,
  p_description  text,
  p_occurred_at  timestamptz,
  p_actor        text,
  p_raw          jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_order_status public.order_status;
begin
  select s.order_id, o.status into v_order_id, v_order_status
    from public.shipments s join public.orders o on o.id = s.order_id
   where s.id = p_shipment_id
     for update of s;
  if v_order_id is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;

  insert into public.shipment_events (shipment_id, status, location, description, occurred_at, raw)
  values (p_shipment_id, p_status, p_location, p_description, coalesce(p_occurred_at, now()), p_raw)
  on conflict (shipment_id, occurred_at, status) do nothing;

  update public.shipments set status = p_status where id = p_shipment_id;

  if p_status = 'delivered' and v_order_status = 'shipped' then
    perform public.set_order_status(v_order_id, 'delivered', p_actor, 'Delivered');
  elsif p_status = 'rto' and v_order_status = 'shipped' then
    perform public.set_order_status(v_order_id, 'rto', p_actor, 'Returning to origin');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fixed-window rate limiting (works across serverless instances).
-- -----------------------------------------------------------------------------
create table public.rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  hits          int not null
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_key text, p_window_seconds int, p_max int)
returns boolean   -- true = allowed
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
     set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
         window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- -----------------------------------------------------------------------------
-- Account deletion (DPDP): orders are kept for tax/accounting, but the person
-- is anonymised and their saved data removed. Blocked while orders are open.
-- -----------------------------------------------------------------------------
create or replace function public.anonymize_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders
              where user_id = p_user_id
                and status in ('pending_payment', 'confirmed', 'processing', 'shipped', 'rto')) then
    raise exception 'OPEN_ORDERS';
  end if;
  if (select role from public.profiles where id = p_user_id) in ('staff', 'admin') then
    raise exception 'STAFF_ACCOUNT';
  end if;

  delete from public.addresses where user_id = p_user_id;
  delete from public.cart_items where user_id = p_user_id;
  delete from public.wishlist_items where user_id = p_user_id;
  update public.profiles
     set full_name = null, email = null, phone = null, marketing_opt_in = false
   where id = p_user_id;
  update public.orders
     set shipping_address = jsonb_build_object('name', 'Deleted user', 'city', shipping_address ->> 'city',
                                               'state', shipping_address ->> 'state', 'pincode', shipping_address ->> 'pincode'),
         contact_email = null
   where user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke execute on function
  public.audit(uuid, text, text, text, jsonb),
  public.adjust_stock(uuid, int, text, uuid, text),
  public.create_shipment(uuid, text, text, text, text, text, jsonb),
  public.add_shipment_event(uuid, text, text, text, timestamptz, text, jsonb),
  public.hit_rate_limit(text, int, int),
  public.anonymize_user(uuid)
from public, anon, authenticated;

grant execute on function
  public.audit(uuid, text, text, text, jsonb),
  public.adjust_stock(uuid, int, text, uuid, text),
  public.create_shipment(uuid, text, text, text, text, text, jsonb),
  public.add_shipment_event(uuid, text, text, text, timestamptz, text, jsonb),
  public.hit_rate_limit(text, int, int),
  public.anonymize_user(uuid)
to service_role;

-- Staff need to see reviews' products even if inactive, and admins manage collections/notes via RLS (already granted).
-- Customers may only review products they can see.
drop policy "reviews: author insert" on public.reviews;
create policy "reviews: author insert" on public.reviews
  for insert to authenticated with check (
    user_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.products p where p.id = product_id and p.is_active));
