-- =============================================================================
-- Collection offers: Buy 1 Get 1 within a collection (e.g. Silver / Golden tiers).
-- The cheaper item of each pair is free. Applied in quote_cart (server pricing),
-- before coupons; stored on the order as offer_discount.
-- =============================================================================

alter table public.collections add column bogo boolean not null default false;

alter table public.orders add column offer_discount int not null default 0 check (offer_discount >= 0);
alter table public.orders drop constraint orders_check;
alter table public.orders add constraint orders_amounts_check
  check (total = subtotal - offer_discount - discount + shipping_fee + cod_fee);

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
  v_offer          int := 0;
  v_offers         jsonb := '[]'::jsonb;
  v_net            int;   -- subtotal after offers: base for coupons, shipping and COD limits
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

  -- Buy-1-Get-1 offers: within each BOGO collection, units are sorted by price
  -- (high → low) and every second unit is free, i.e. the cheaper of each pair.
  with units as (
    select (l ->> 'unit_price')::int as price, t.slug, t.name
      from jsonb_array_elements(v_lines) l
      cross join lateral generate_series(1, (l ->> 'qty')::int)
      join lateral (
        select c.slug, c.name
          from public.product_collections pc
          join public.collections c on c.id = pc.collection_id
         where pc.product_id = (l ->> 'product_id')::uuid and c.bogo and c.is_active
         order by c.sort, c.slug
         limit 1
      ) t on true
     where l ->> 'issue' is null
  ), ranked as (
    select price, slug, name, row_number() over (partition by slug order by price desc) as rn
      from units
  ), per_tier as (
    select slug, name, count(*) filter (where rn % 2 = 0)::int as free_units,
           coalesce(sum(price) filter (where rn % 2 = 0), 0)::int as amount,
           (count(*) % 2 = 1) as needs_one_more
      from ranked group by slug, name
  )
  select coalesce(sum(amount), 0)::int,
         coalesce(jsonb_agg(jsonb_build_object('collection', slug, 'name', name, 'free_units', free_units,
                                               'amount', amount, 'add_one_more', needs_one_more) order by slug), '[]'::jsonb)
    into v_offer, v_offers
    from per_tier;
  v_net := v_subtotal - v_offer;

  -- Coupon (applies to the amount after offers)
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
    elsif v_net < v_coupon.min_order then
      v_coupon_error := format('Add items worth ₹%s more to use this coupon.',
                               to_char(ceil((v_coupon.min_order - v_net) / 100.0), 'FM99,99,999'));
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
          v_discount := floor(v_net * v_coupon.value / 100.0)::int;
          if v_coupon.max_discount is not null then
            v_discount := least(v_discount, v_coupon.max_discount);
          end if;
        when 'flat' then
          v_discount := least(v_coupon.value, v_net);
        when 'free_shipping' then
          v_free_ship := true;
      end case;
    else
      v_coupon := null;
    end if;
  end if;

  -- Shipping
  if v_subtotal > 0 and not v_free_ship
     and (v_net - v_discount) < coalesce((v_shipping ->> 'free_above')::int, 0) then
    v_shipping_fee := coalesce((v_shipping ->> 'flat_fee')::int, 0);
  end if;

  -- COD availability / fee
  v_cod_available := coalesce((v_cod ->> 'enabled')::boolean, false);
  if not v_cod_available then
    v_cod_reason := 'Cash on Delivery is currently unavailable.';
  elsif (v_net - v_discount + v_shipping_fee) > coalesce((v_cod ->> 'max_order')::int, 2147483647) then
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

  v_total := v_net - v_discount + v_shipping_fee + v_cod_fee;

  -- GST contained in the (inclusive) item prices, after spreading the discount
  -- proportionally across lines.
  if v_subtotal > 0 then
    select coalesce(sum(round(
             (l ->> 'line_total')::numeric * (v_net - v_discount) / v_subtotal
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
    'offer_discount', v_offer,
    'offers', v_offers,
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
    subtotal, offer_discount, discount, shipping_fee, cod_fee, total, gst_amount,
    coupon_id, coupon_code, reserved_until
  ) values (
    v_order_number, p_user_id, p_checkout_key, v_status, p_payment_method, 'pending',
    jsonb_build_object(
      'name', p_address ->> 'name', 'phone', p_address ->> 'phone',
      'line1', p_address ->> 'line1', 'line2', p_address ->> 'line2',
      'landmark', p_address ->> 'landmark', 'city', p_address ->> 'city',
      'state', p_address ->> 'state', 'pincode', p_address ->> 'pincode'),
    p_contact_email,
    (v_quote ->> 'subtotal')::int, (v_quote ->> 'offer_discount')::int, (v_quote ->> 'discount')::int,
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

revoke execute on function public.quote_cart(uuid, jsonb, text, public.payment_method) from public, anon, authenticated;
revoke execute on function public.place_order(uuid, uuid, jsonb, jsonb, public.payment_method, text, text) from public, anon, authenticated;
grant execute on function public.quote_cart(uuid, jsonb, text, public.payment_method) to service_role;
grant execute on function public.place_order(uuid, uuid, jsonb, jsonb, public.payment_method, text, text) to service_role;
