-- =============================================================================
-- Stargod Perfumes: business logic
-- Pricing, stock, coupons and order state transitions live here so they are
-- atomic and can't be bypassed by a client. Functions that mutate orders are
-- callable only by service_role (the Next.js server).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auth helpers
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, phone, full_name)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email/phone in sync when the user verifies a new one.
create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email, phone = new.phone
   where id = new.id
     and (email is distinct from new.email or phone is distinct from new.phone);
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, phone on auth.users
  for each row execute function public.handle_user_updated();

-- -----------------------------------------------------------------------------
-- Reviews: verified-purchase flag, moderation reset, rating aggregate
-- -----------------------------------------------------------------------------
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
  -- Customers can never set the moderation status themselves: new reviews and
  -- edited reviews go (back) to 'pending'. Admins and the server (no auth.uid())
  -- set status explicitly.
  if (select auth.uid()) is not null and not public.is_admin() then
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

create trigger reviews_before_write
  before insert or update on public.reviews
  for each row execute function public.reviews_before_write();

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_avg = coalesce(s.avg, 0),
         rating_count = coalesce(s.cnt, 0)
    from (
      select round(avg(rating)::numeric, 1) as avg, count(*)::int as cnt
        from public.reviews
       where product_id = v_product and status = 'approved'
    ) s
   where p.id = v_product;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- -----------------------------------------------------------------------------
-- Order status history (automatic). Callers may set a note/actor for the
-- current transaction with set_config('app.status_note' / 'app.actor', ..., true).
-- -----------------------------------------------------------------------------
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, note, actor)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      nullif(current_setting('app.status_note', true), ''),
      coalesce(nullif(current_setting('app.actor', true), ''), 'system')
    );
  end if;
  return null;
end;
$$;

create trigger orders_log_status
  after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- -----------------------------------------------------------------------------
-- Settings helper
-- -----------------------------------------------------------------------------
create or replace function public.get_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.store_settings where key = p_key;
$$;

-- -----------------------------------------------------------------------------
-- quote_cart: the single source of truth for prices.
--
--   p_items: [{"variant_id": "<uuid>", "qty": 2}, ...]
--
-- Returns jsonb:
--   { lines: [...], subtotal, mrp_total, discount, shipping_fee, cod_fee, total,
--     gst_amount, coupon: {...} | null, coupon_error, free_shipping_threshold,
--     cod_available, cod_unavailable_reason, errors: [...] }
--
-- Never raises for user-fixable problems (stock, coupon); it reports them so the
-- cart page can show them. place_order() turns them into hard failures.
-- -----------------------------------------------------------------------------
create or replace function public.quote_cart(
  p_user_id         uuid,
  p_items           jsonb,
  p_coupon_code     text default null,
  p_payment_method  public.payment_method default 'prepaid'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shipping       jsonb := coalesce(public.get_setting('shipping'), '{}'::jsonb);
  v_cod            jsonb := coalesce(public.get_setting('cod'), '{}'::jsonb);
  v_lines          jsonb;
  v_errors         jsonb := '[]'::jsonb;
  v_subtotal       int := 0;
  v_mrp_total      int := 0;
  v_discount       int := 0;
  v_free_ship      boolean := false;
  v_shipping_fee   int := 0;
  v_cod_fee        int := 0;
  v_total          int;
  v_gst            int := 0;
  v_coupon         public.coupons;
  v_coupon_error   text;
  v_user_uses      int;
  v_prior_orders   int;
  v_cod_available  boolean;
  v_cod_reason     text;
  v_line_count     int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_ITEMS' using errcode = '22023';
  end if;

  -- Normalise: merge duplicate variants, validate quantities.
  with raw as (
    select (e ->> 'variant_id')::uuid as variant_id, (e ->> 'qty')::int as qty
      from jsonb_array_elements(p_items) e
  ), merged as (
    select variant_id, sum(qty)::int as qty from raw group by variant_id
  ), priced as (
    select m.variant_id, m.qty,
           v.sku, v.label, v.size_ml, v.price, v.mrp, v.stock,
           (v.is_active and p.is_active) as is_active,
           p.id as product_id, p.name as product_name, p.slug as product_slug, p.gst_rate,
           (select pi.storage_path from public.product_images pi
             where pi.product_id = p.id and (pi.variant_id is null or pi.variant_id = v.id)
             order by (pi.variant_id is null), pi.sort limit 1) as image_path
      from merged m
      left join public.product_variants v on v.id = m.variant_id
      left join public.products p on p.id = v.product_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'variant_id', variant_id,
           'product_id', product_id,
           'product_name', product_name,
           'product_slug', product_slug,
           'sku', sku,
           'label', label,
           'size_ml', size_ml,
           'image_path', image_path,
           'qty', qty,
           'unit_price', price,
           'mrp', mrp,
           'gst_rate', gst_rate,
           'line_total', price * qty,
           'stock', stock,
           'issue', case
             when sku is null or not is_active then 'unavailable'
             when qty < 1 or qty > 10 then 'invalid_qty'
             when stock < qty then 'insufficient_stock'
           end
         ) order by product_name, size_ml), '[]'::jsonb),
         count(*)
    into v_lines, v_line_count
    from priced;

  if v_line_count = 0 then
    v_errors := v_errors || jsonb_build_object('code', 'EMPTY_CART');
  elsif v_line_count > 20 then
    v_errors := v_errors || jsonb_build_object('code', 'TOO_MANY_ITEMS');
  end if;

  select v_errors || coalesce(jsonb_agg(jsonb_build_object(
           'code', upper(l ->> 'issue'),
           'variant_id', l ->> 'variant_id',
           'available', (l ->> 'stock')::int)), '[]'::jsonb)
    into v_errors
    from jsonb_array_elements(v_lines) l
   where l ->> 'issue' is not null;

  select coalesce(sum((l ->> 'line_total')::int), 0),
         coalesce(sum((l ->> 'mrp')::int * (l ->> 'qty')::int), 0)
    into v_subtotal, v_mrp_total
    from jsonb_array_elements(v_lines) l
   where l ->> 'issue' is null;

  -- Coupon
  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons where code = upper(trim(p_coupon_code));

    if v_coupon.id is null or not v_coupon.is_active then
      v_coupon_error := 'This coupon code is not valid.';
    elsif v_coupon.starts_at is not null and now() < v_coupon.starts_at then
      v_coupon_error := 'This coupon is not active yet.';
    elsif v_coupon.ends_at is not null and now() > v_coupon.ends_at then
      v_coupon_error := 'This coupon has expired.';
    elsif v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      v_coupon_error := 'This coupon has reached its usage limit.';
    elsif v_subtotal < v_coupon.min_order then
      v_coupon_error := format('Add items worth ₹%s more to use this coupon.',
                               to_char(ceil((v_coupon.min_order - v_subtotal) / 100.0), 'FM99,99,999'));
    elsif p_user_id is null then
      v_coupon_error := 'Please log in to use this coupon.';
    else
      select count(*) into v_user_uses
        from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = p_user_id;
      if v_user_uses >= v_coupon.per_user_limit then
        v_coupon_error := 'You have already used this coupon.';
      elsif v_coupon.first_order_only then
        select count(*) into v_prior_orders
          from public.orders
         where user_id = p_user_id
           and status not in ('pending_payment', 'payment_failed', 'cancelled');
        if v_prior_orders > 0 then
          v_coupon_error := 'This coupon is only valid on your first order.';
        end if;
      end if;
    end if;

    if v_coupon_error is null then
      case v_coupon.type
        when 'percent' then
          v_discount := floor(v_subtotal * v_coupon.value / 100.0)::int;
          if v_coupon.max_discount is not null then
            v_discount := least(v_discount, v_coupon.max_discount);
          end if;
        when 'flat' then
          v_discount := least(v_coupon.value, v_subtotal);
        when 'free_shipping' then
          v_free_ship := true;
      end case;
    else
      v_coupon := null;
    end if;
  end if;

  -- Shipping
  if v_subtotal > 0 and not v_free_ship
     and (v_subtotal - v_discount) < coalesce((v_shipping ->> 'free_above')::int, 0) then
    v_shipping_fee := coalesce((v_shipping ->> 'flat_fee')::int, 0);
  end if;

  -- COD availability / fee
  v_cod_available := coalesce((v_cod ->> 'enabled')::boolean, false);
  if not v_cod_available then
    v_cod_reason := 'Cash on Delivery is currently unavailable.';
  elsif (v_subtotal - v_discount + v_shipping_fee) > coalesce((v_cod ->> 'max_order')::int, 2147483647) then
    v_cod_available := false;
    v_cod_reason := format('Cash on Delivery is available on orders up to ₹%s.',
                           to_char(((v_cod ->> 'max_order')::int) / 100, 'FM99,99,999'));
  end if;

  if p_payment_method = 'cod' then
    if v_cod_available then
      v_cod_fee := coalesce((v_cod ->> 'fee')::int, 0);
    else
      v_errors := v_errors || jsonb_build_object('code', 'COD_UNAVAILABLE', 'message', v_cod_reason);
    end if;
  end if;

  v_total := v_subtotal - v_discount + v_shipping_fee + v_cod_fee;

  -- GST contained in the (inclusive) item prices, after spreading the discount
  -- proportionally across lines.
  if v_subtotal > 0 then
    select coalesce(sum(round(
             (l ->> 'line_total')::numeric * (v_subtotal - v_discount) / v_subtotal
             * (l ->> 'gst_rate')::numeric / (100 + (l ->> 'gst_rate')::numeric)
           )), 0)::int
      into v_gst
      from jsonb_array_elements(v_lines) l
     where l ->> 'issue' is null;
  end if;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'mrp_total', v_mrp_total,
    'discount', v_discount,
    'shipping_fee', v_shipping_fee,
    'cod_fee', v_cod_fee,
    'total', v_total,
    'gst_amount', v_gst,
    'coupon', case when v_coupon.id is null then null else jsonb_build_object(
                'id', v_coupon.id, 'code', v_coupon.code, 'type', v_coupon.type,
                'description', v_coupon.description) end,
    'coupon_error', v_coupon_error,
    'free_shipping_threshold', (v_shipping ->> 'free_above')::int,
    'cod_available', v_cod_available,
    'cod_unavailable_reason', v_cod_reason,
    'errors', v_errors
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Internal: put an order's stock back
-- -----------------------------------------------------------------------------
create or replace function public._restock_order(p_order_id uuid, p_reason text, p_actor text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select variant_id, sum(qty)::int as qty
      from public.order_items
     where order_id = p_order_id and variant_id is not null
     group by variant_id
     order by variant_id                -- consistent lock order
  loop
    update public.product_variants set stock = stock + r.qty where id = r.variant_id;
    insert into public.inventory_movements (variant_id, delta, reason, order_id, actor)
    values (r.variant_id, r.qty, p_reason, p_order_id, p_actor);
  end loop;
end;
$$;

-- Internal: try to take stock for every line of an order; all-or-nothing.
create or replace function public._reserve_order_stock(p_order_id uuid, p_reason text, p_actor text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select variant_id, sum(qty)::int as qty
      from public.order_items
     where order_id = p_order_id
     group by variant_id
     order by variant_id
  loop
    update public.product_variants
       set stock = stock - r.qty
     where id = r.variant_id and stock >= r.qty;
    if not found then
      raise exception 'OUT_OF_STOCK' using errcode = 'P0001';
    end if;
    insert into public.inventory_movements (variant_id, delta, reason, order_id, actor)
    values (r.variant_id, -r.qty, p_reason, p_order_id, p_actor);
  end loop;
  return true;
exception
  when raise_exception then
    return false;   -- the sub-transaction is rolled back, so no partial decrements remain
end;
$$;

-- Internal: give back a coupon use for an order that never completed.
create or replace function public._release_coupon(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon_id uuid;
begin
  delete from public.coupon_redemptions where order_id = p_order_id returning coupon_id into v_coupon_id;
  if v_coupon_id is not null then
    update public.coupons set used_count = greatest(used_count - 1, 0) where id = v_coupon_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- place_order: atomically price, reserve stock, redeem coupon and create the order.
--
--   p_address: {name, phone, line1, line2?, landmark?, city, state, pincode}
--
-- Raises with a machine-readable message:
--   EMPTY_CART, UNAVAILABLE, INSUFFICIENT_STOCK, INVALID_QTY, COUPON_INVALID:<msg>,
--   COD_UNAVAILABLE, INVALID_ADDRESS, OUT_OF_STOCK
-- Calling again with the same checkout_key returns the existing order.
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_user_id         uuid,
  p_checkout_key    uuid,
  p_items           jsonb,
  p_address         jsonb,
  p_payment_method  public.payment_method,
  p_coupon_code     text default null,
  p_contact_email   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing      public.orders;
  v_quote         jsonb;
  v_hold_minutes  int := coalesce((public.get_setting('checkout') ->> 'hold_minutes')::int, 30);
  v_order_id      uuid;
  v_order_number  text;
  v_coupon_id     uuid;
  v_status        public.order_status;
  v_attempt       int := 0;
  v_variant_ids   uuid[];
begin
  -- Idempotency
  select * into v_existing from public.orders where checkout_key = p_checkout_key;
  if v_existing.id is not null then
    if v_existing.user_id <> p_user_id then
      raise exception 'CHECKOUT_KEY_CONFLICT';
    end if;
    return jsonb_build_object(
      'order_id', v_existing.id, 'order_number', v_existing.order_number,
      'total', v_existing.total, 'status', v_existing.status, 'existing', true);
  end if;

  -- Address sanity (full validation is done in the app with zod)
  if p_address is null
     or coalesce(p_address ->> 'name', '') = ''
     or coalesce(p_address ->> 'line1', '') = ''
     or coalesce(p_address ->> 'city', '') = ''
     or coalesce(p_address ->> 'state', '') = ''
     or coalesce(p_address ->> 'phone', '') !~ '^[6-9][0-9]{9}$'
     or coalesce(p_address ->> 'pincode', '') !~ '^[1-9][0-9]{5}$' then
    raise exception 'INVALID_ADDRESS';
  end if;

  -- Lock the variant rows (in id order to avoid deadlocks) before pricing, so the
  -- price and stock we quote are the ones we commit.
  select array_agg(distinct (e ->> 'variant_id')::uuid)
    into v_variant_ids
    from jsonb_array_elements(p_items) e;

  perform 1 from public.product_variants
   where id = any (v_variant_ids)
   order by id
     for update;

  -- Lock the coupon row so usage limits can't be exceeded concurrently.
  if nullif(trim(p_coupon_code), '') is not null then
    perform 1 from public.coupons where code = upper(trim(p_coupon_code)) for update;
  end if;

  v_quote := public.quote_cart(p_user_id, p_items, p_coupon_code, p_payment_method);

  if jsonb_array_length(v_quote -> 'errors') > 0 then
    raise exception '%', v_quote -> 'errors' -> 0 ->> 'code';
  end if;
  if nullif(trim(p_coupon_code), '') is not null and v_quote ->> 'coupon_error' is not null then
    raise exception 'COUPON_INVALID:%', v_quote ->> 'coupon_error';
  end if;

  v_coupon_id := (v_quote -> 'coupon' ->> 'id')::uuid;
  v_status := case when p_payment_method = 'cod' then 'confirmed' else 'pending_payment' end;

  -- Order number: SG-YYMMDD-XXXXXX (IST date). Retry on the rare collision.
  loop
    v_attempt := v_attempt + 1;
    v_order_number := 'SG-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-'
                      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.orders where order_number = v_order_number);
    if v_attempt > 5 then
      raise exception 'ORDER_NUMBER_EXHAUSTED';
    end if;
  end loop;

  perform set_config('app.actor', 'customer', true);
  perform set_config('app.status_note',
    case when p_payment_method = 'cod' then 'COD order placed' else 'Awaiting payment' end, true);

  insert into public.orders (
    order_number, user_id, checkout_key, status, payment_method, payment_status,
    shipping_address, contact_email,
    subtotal, discount, shipping_fee, cod_fee, total, gst_amount,
    coupon_id, coupon_code, reserved_until
  ) values (
    v_order_number, p_user_id, p_checkout_key, v_status, p_payment_method, 'pending',
    jsonb_build_object(
      'name', p_address ->> 'name', 'phone', p_address ->> 'phone',
      'line1', p_address ->> 'line1', 'line2', p_address ->> 'line2',
      'landmark', p_address ->> 'landmark', 'city', p_address ->> 'city',
      'state', p_address ->> 'state', 'pincode', p_address ->> 'pincode'),
    p_contact_email,
    (v_quote ->> 'subtotal')::int, (v_quote ->> 'discount')::int,
    (v_quote ->> 'shipping_fee')::int, (v_quote ->> 'cod_fee')::int,
    (v_quote ->> 'total')::int, (v_quote ->> 'gst_amount')::int,
    v_coupon_id, v_quote -> 'coupon' ->> 'code',
    case when p_payment_method = 'prepaid' then now() + make_interval(mins => v_hold_minutes) end
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_id, product_name, product_slug, variant_label, sku,
    image_path, unit_price, mrp, qty, gst_rate, line_total)
  select v_order_id,
         (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
         l ->> 'product_name', l ->> 'product_slug', l ->> 'label', l ->> 'sku',
         l ->> 'image_path', (l ->> 'unit_price')::int, (l ->> 'mrp')::int,
         (l ->> 'qty')::int, (l ->> 'gst_rate')::numeric, (l ->> 'line_total')::int
    from jsonb_array_elements(v_quote -> 'lines') l;

  if not public._reserve_order_stock(v_order_id, 'order', 'customer') then
    raise exception 'OUT_OF_STOCK';
  end if;

  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (v_coupon_id, p_user_id, v_order_id);
    update public.coupons set used_count = used_count + 1 where id = v_coupon_id;
  end if;

  -- COD is final now; prepaid carts are cleared once payment succeeds.
  if p_payment_method = 'cod' then
    delete from public.cart_items where user_id = p_user_id and variant_id = any (v_variant_ids);
  end if;

  return jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'total', (v_quote ->> 'total')::int, 'status', v_status, 'existing', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- record_payment: upsert a payment attempt (any status) reported by Cashfree.
-- -----------------------------------------------------------------------------
create or replace function public.record_payment(
  p_order_number   text,
  p_cf_payment_id  text,
  p_amount         int,
  p_status         text,
  p_method         text,
  p_raw            jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_payment_id uuid;
begin
  select id into v_order_id from public.orders where order_number = p_order_number;
  if v_order_id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  insert into public.payments (order_id, cf_payment_id, amount, status, method, raw)
  values (v_order_id, p_cf_payment_id, p_amount, p_status, p_method, p_raw)
  on conflict (cf_payment_id) do update
     set status = excluded.status,
         method = coalesce(excluded.method, public.payments.method),
         raw = excluded.raw
     -- never downgrade a successful payment
   where public.payments.status <> 'SUCCESS'
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- mark_order_paid: idempotent transition after the server has VERIFIED the
-- payment with Cashfree (Get Order / signed webhook).
--
-- Returns one of: 'paid', 'already_paid', 'amount_mismatch', 'needs_refund', 'not_found'
-- -----------------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_number   text,
  p_cf_payment_id  text,
  p_amount         int,
  p_method         text,
  p_raw            jsonb,
  p_actor          text default 'cashfree'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where order_number = p_order_number for update;
  if v_order.id is null then
    return 'not_found';
  end if;

  perform public.record_payment(p_order_number, p_cf_payment_id, p_amount, 'SUCCESS', p_method, p_raw);

  if v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    return 'already_paid';
  end if;

  perform set_config('app.actor', p_actor, true);

  if p_amount <> v_order.total then
    perform set_config('app.status_note', format('Amount mismatch: paid %s, expected %s', p_amount, v_order.total), true);
    update public.orders
       set payment_status = 'paid', paid_at = now(), needs_refund = true,
           admin_note = concat_ws(E'\n', admin_note,
             format('Amount mismatch: paid %s paise, expected %s paise (%s)', p_amount, v_order.total, p_cf_payment_id))
     where id = v_order.id;
    return 'amount_mismatch';
  end if;

  if v_order.status = 'pending_payment' then
    perform set_config('app.status_note', 'Payment received', true);
    update public.orders
       set status = 'confirmed', payment_status = 'paid', paid_at = now(), reserved_until = null
     where id = v_order.id;

  elsif v_order.status in ('payment_failed', 'cancelled') and v_order.cancelled_at is null then
    -- The stock hold expired before the payment arrived. Try to take the stock again.
    if public._reserve_order_stock(v_order.id, 'rereserve', p_actor) then
      perform set_config('app.status_note', 'Late payment received; stock re-reserved', true);
      update public.orders
         set status = 'confirmed', payment_status = 'paid', paid_at = now(), reserved_until = null
       where id = v_order.id;
      if v_order.coupon_id is not null then
        insert into public.coupon_redemptions (coupon_id, user_id, order_id)
        values (v_order.coupon_id, v_order.user_id, v_order.id)
        on conflict (order_id) do nothing;
        if found then
          update public.coupons set used_count = used_count + 1 where id = v_order.coupon_id;
        end if;
      end if;
    else
      update public.orders
         set payment_status = 'paid', paid_at = now(), needs_refund = true,
             admin_note = concat_ws(E'\n', admin_note, 'Late payment but stock is gone: refund required')
       where id = v_order.id;
      return 'needs_refund';
    end if;

  else
    -- Paid after an admin/customer cancellation: keep it cancelled and refund.
    update public.orders
       set payment_status = 'paid', paid_at = now(), needs_refund = true,
           admin_note = concat_ws(E'\n', admin_note, format('Payment received on a %s order: refund required', v_order.status))
     where id = v_order.id;
    return 'needs_refund';
  end if;

  delete from public.cart_items ci
   using public.order_items oi
   where oi.order_id = v_order.id
     and ci.user_id = v_order.user_id
     and ci.variant_id = oi.variant_id;

  return 'paid';
end;
$$;

-- -----------------------------------------------------------------------------
-- expire_order_hold: a prepaid order whose hold expired without payment.
-- The server checks Cashfree's Get Order first, so a paid order is never expired.
-- Returns true if the order was expired by this call.
-- -----------------------------------------------------------------------------
create or replace function public.expire_order_hold(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null or v_order.status <> 'pending_payment' or v_order.payment_status = 'paid' then
    return false;
  end if;

  perform public._restock_order(v_order.id, 'expired', 'system');
  perform public._release_coupon(v_order.id);

  perform set_config('app.actor', 'system', true);
  perform set_config('app.status_note', 'Payment not completed; stock released', true);
  update public.orders
     set status = 'payment_failed', payment_status = 'failed', reserved_until = null
   where id = v_order.id;
  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- cancel_order: by customer (before shipping) or admin.
-- Returns {cancelled: bool, refund_due: int}. The refund itself is done by the
-- server through Cashfree + create_refund().
-- -----------------------------------------------------------------------------
create or replace function public.cancel_order(
  p_order_id  uuid,
  p_actor     text,
  p_reason    text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_refunded int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('pending_payment', 'confirmed', 'processing') then
    raise exception 'NOT_CANCELLABLE';
  end if;
  if exists (select 1 from public.shipments where order_id = p_order_id and is_active) then
    raise exception 'ACTIVE_SHIPMENT';
  end if;

  perform public._restock_order(v_order.id, 'cancel', p_actor);
  if v_order.payment_status <> 'paid' then
    perform public._release_coupon(v_order.id);
  end if;

  perform set_config('app.actor', p_actor, true);
  perform set_config('app.status_note', coalesce(p_reason, 'Order cancelled'), true);
  update public.orders
     set status = 'cancelled', cancelled_at = now(), reserved_until = null,
         payment_status = case when payment_status = 'pending' then 'failed'::public.payment_status else payment_status end
   where id = v_order.id;

  select coalesce(sum(amount), 0) into v_refunded
    from public.refunds where order_id = v_order.id and status <> 'failed';

  return jsonb_build_object(
    'cancelled', true,
    'refund_due', case when v_order.payment_status = 'paid' then v_order.total - v_refunded else 0 end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Refunds
-- -----------------------------------------------------------------------------
create or replace function public.create_refund(
  p_order_id  uuid,
  p_amount    int,
  p_reason    text,
  p_actor     text
)
returns public.refunds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.orders;
  v_used    int;
  v_count   int;
  v_refund  public.refunds;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.payment_method <> 'prepaid' or v_order.payment_status not in ('paid', 'partially_refunded') then
    raise exception 'NOT_REFUNDABLE';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select coalesce(sum(amount), 0), count(*) into v_used, v_count
    from public.refunds where order_id = p_order_id and status <> 'failed';
  if v_used + p_amount > v_order.total then
    raise exception 'REFUND_EXCEEDS_PAID';
  end if;

  insert into public.refunds (order_id, refund_id, amount, reason, initiated_by)
  values (p_order_id,
          format('RF-%s-%s', v_order.order_number, (select count(*) + 1 from public.refunds where order_id = p_order_id)),
          p_amount, p_reason, p_actor)
  returning * into v_refund;

  return v_refund;
end;
$$;

-- Apply a refund status from Cashfree (API response or webhook). Idempotent.
create or replace function public.apply_refund_status(
  p_refund_id     text,
  p_status        public.refund_status,
  p_cf_refund_id  text,
  p_raw           jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund   public.refunds;
  v_total    int;
  v_success  int;
begin
  select * into v_refund from public.refunds where refund_id = p_refund_id for update;
  if v_refund.id is null then
    raise exception 'REFUND_NOT_FOUND';
  end if;
  -- terminal states don't move backwards
  if v_refund.status = 'success' or (v_refund.status = 'failed' and p_status = 'pending') then
    return;
  end if;

  update public.refunds
     set status = p_status,
         cf_refund_id = coalesce(p_cf_refund_id, cf_refund_id),
         raw = coalesce(p_raw, raw),
         processed_at = case when p_status <> 'pending' then now() end
   where id = v_refund.id;

  select o.total, coalesce(sum(r.amount) filter (where r.status = 'success'), 0)
    into v_total, v_success
    from public.orders o
    left join public.refunds r on r.order_id = o.id
   where o.id = v_refund.order_id
   group by o.total;

  update public.orders
     set payment_status = case
           when v_success >= v_total then 'refunded'::public.payment_status
           when v_success > 0 then 'partially_refunded'::public.payment_status
           else payment_status end,
         needs_refund = case when v_success >= v_total then false else needs_refund end
   where id = v_refund.order_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin status changes (non-cancel transitions, e.g. confirmed -> processing)
-- -----------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id  uuid,
  p_status    public.order_status,
  p_actor     text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.order_status;
begin
  select status into v_from from public.orders where id = p_order_id for update;
  if v_from is null then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if p_status in ('cancelled', 'payment_failed', 'pending_payment') then
    raise exception 'USE_DEDICATED_FUNCTION';
  end if;
  if not (
       (v_from = 'confirmed'  and p_status in ('processing', 'shipped'))
    or (v_from = 'processing' and p_status in ('shipped'))
    or (v_from = 'shipped'    and p_status in ('delivered', 'rto'))
    or (v_from = 'delivered'  and p_status in ('returned'))
    or (v_from = 'rto'        and p_status in ('returned'))
  ) then
    raise exception 'INVALID_TRANSITION:% -> %', v_from, p_status;
  end if;

  perform set_config('app.actor', p_actor, true);
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update public.orders
     set status = p_status,
         payment_status = case
           when p_status = 'delivered' and payment_method = 'cod' then 'paid'::public.payment_status
           else payment_status end,
         paid_at = case
           when p_status = 'delivered' and payment_method = 'cod' then now()
           else paid_at end
   where id = p_order_id;

  if p_status = 'returned' then
    perform public._restock_order(p_order_id, 'restock', p_actor);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges: lock down everything, then open only what clients may call.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.handle_new_user(),
  public.handle_user_updated(),
  public.reviews_before_write(),
  public.refresh_product_rating(),
  public.log_order_status(),
  public.get_setting(text),
  public.quote_cart(uuid, jsonb, text, public.payment_method),
  public._restock_order(uuid, text, text),
  public._reserve_order_stock(uuid, text, text),
  public._release_coupon(uuid),
  public.place_order(uuid, uuid, jsonb, jsonb, public.payment_method, text, text),
  public.record_payment(text, text, int, text, text, jsonb),
  public.mark_order_paid(text, text, int, text, jsonb, text),
  public.expire_order_hold(uuid),
  public.cancel_order(uuid, text, text),
  public.create_refund(uuid, int, text, text),
  public.apply_refund_status(text, public.refund_status, text, jsonb),
  public.set_order_status(uuid, public.order_status, text, text)
from public, anon, authenticated;

grant execute on function
  public.get_setting(text),
  public.quote_cart(uuid, jsonb, text, public.payment_method),
  public.place_order(uuid, uuid, jsonb, jsonb, public.payment_method, text, text),
  public.record_payment(text, text, int, text, text, jsonb),
  public.mark_order_paid(text, text, int, text, jsonb, text),
  public.expire_order_hold(uuid),
  public.cancel_order(uuid, text, text),
  public.create_refund(uuid, int, text, text),
  public.apply_refund_status(text, public.refund_status, text, jsonb),
  public.set_order_status(uuid, public.order_status, text, text)
to service_role;

-- is_admin() is used inside RLS policies, so signed-in users must be able to run it.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
