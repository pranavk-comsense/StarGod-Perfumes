-- pgTAP tests. Run with: npm run db:test   (requires seeded local DB)
begin;
create extension if not exists pgtap with schema extensions;
-- Demo products are hidden in the seed; use them as fixtures for this transaction.
update public.products set is_active = true;
update public.collections set bogo = false;
select plan(45);

-- Fixtures -------------------------------------------------------------------
create temp table t_ids as
select
  '00000000-0000-4000-8000-000000000002'::uuid as aarav,
  '00000000-0000-4000-8000-000000000003'::uuid as diya,
  (select id from public.product_variants where sku = 'SG-MO-50')  as mo50,   -- ₹1,499, stock 40
  (select id from public.product_variants where sku = 'SG-MA-6')   as ma6,    -- ₹599
  (select id from public.product_variants where sku = 'SG-LM-100') as lm100,  -- stock 0
  (select id from public.product_variants where sku = 'SG-JN-100') as jn100,  -- stock 2
  '{"name":"Aarav Mehta","phone":"9876543210","line1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}'::jsonb as addr;
grant select on t_ids to authenticated, anon;

-- Pricing ------------------------------------------------------------------
select is(
  (public.quote_cart(null, jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 2))) ->> 'total')::int,
  299800, 'free shipping above threshold: 2 x 1499 = 2998');

select is(
  (public.quote_cart(null, jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1))) ->> 'shipping_fee')::int,
  7900, 'flat shipping fee below threshold');

select is(
  (public.quote_cart(null, jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1)), null, 'cod') ->> 'total')::int,
  59900 + 7900 + 4900, 'COD adds COD fee');

select is(
  (public.quote_cart(null, jsonb_build_array(
     jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1),
     jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 2))) -> 'lines' -> 0 ->> 'qty')::int,
  3, 'duplicate variants are merged');

select is(
  (public.quote_cart((select aarav from t_ids), jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 2)), 'welcome10') ->> 'discount')::int,
  29980, 'WELCOME10: 10% (case-insensitive code)');

select is(
  (public.quote_cart((select aarav from t_ids), jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 4)), 'WELCOME10') ->> 'discount')::int,
  30000, 'WELCOME10 capped at max_discount');

select isnt(
  public.quote_cart((select aarav from t_ids), jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1)), 'FLAT200') ->> 'coupon_error',
  null, 'FLAT200 rejected below min order');

select is(
  (public.quote_cart((select aarav from t_ids), jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1)), 'FREESHIP') ->> 'shipping_fee')::int,
  0, 'FREESHIP waives shipping');

select is(
  public.quote_cart(null, jsonb_build_array(jsonb_build_object('variant_id', (select lm100 from t_ids), 'qty', 1))) -> 'errors' -> 0 ->> 'code',
  'INSUFFICIENT_STOCK', 'out-of-stock variant is reported');

select is(
  (public.quote_cart(null, jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 1))) ->> 'gst_amount')::int,
  22866, 'GST extracted from inclusive price (1499 * 18/118)');

-- place_order (prepaid) -------------------------------------------------------
create temp table t_o1 as
select public.place_order((select aarav from t_ids), '11111111-1111-4111-8111-111111111111',
  jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 2)),
  (select addr from t_ids), 'prepaid', 'WELCOME10') as r;

select is((select r ->> 'status' from t_o1), 'pending_payment', 'prepaid order starts pending_payment');
select is((select stock from public.product_variants where sku = 'SG-MO-50'), 38, 'stock reserved on order');
select is((select total from public.orders where id = (select (r ->> 'order_id')::uuid from t_o1)), 299800 - 29980, 'order total uses server prices + coupon');
select is((select used_count from public.coupons where code = 'WELCOME10'), 1, 'coupon redeemed');
select isnt((select reserved_until from public.orders where id = (select (r ->> 'order_id')::uuid from t_o1)), null, 'hold expiry set');
select is((select count(*)::int from public.order_status_history where order_id = (select (r ->> 'order_id')::uuid from t_o1)), 1, 'status history logged');

select is(
  public.place_order((select aarav from t_ids), '11111111-1111-4111-8111-111111111111',
    jsonb_build_array(jsonb_build_object('variant_id', (select mo50 from t_ids), 'qty', 2)),
    (select addr from t_ids), 'prepaid', 'WELCOME10') ->> 'existing',
  'true', 'same checkout_key is idempotent');
select is((select stock from public.product_variants where sku = 'SG-MO-50'), 38, 'idempotent retry does not reserve twice');

select throws_ok(
  format($$select public.place_order(%L, gen_random_uuid(), %L, %L, 'prepaid')$$,
    (select aarav from t_ids),
    jsonb_build_array(jsonb_build_object('variant_id', (select jn100 from t_ids), 'qty', 3)),
    (select addr from t_ids)),
  'P0001', 'INSUFFICIENT_STOCK', 'cannot order more than stock');

select throws_ok(
  format($$select public.place_order(%L, gen_random_uuid(), %L, %L, 'prepaid')$$,
    (select aarav from t_ids),
    jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1)),
    '{"name":"X","phone":"123","line1":"a","city":"b","state":"c","pincode":"000000"}'),
  'P0001', 'INVALID_ADDRESS', 'invalid address rejected');

-- Payment ---------------------------------------------------------------------
select is(
  public.mark_order_paid((select r ->> 'order_number' from t_o1), 'cf_pay_1', 100, 'upi', '{}'),
  'amount_mismatch', 'wrong amount is flagged, not confirmed');
select is((select status::text from public.orders where id = (select (r ->> 'order_id')::uuid from t_o1)), 'pending_payment', 'mismatch keeps order unconfirmed');

-- reset the mismatch for the happy path
update public.orders set payment_status = 'pending', needs_refund = false, paid_at = null where id = (select (r ->> 'order_id')::uuid from t_o1);

select is(
  public.mark_order_paid((select r ->> 'order_number' from t_o1), 'cf_pay_2', 299800 - 29980, 'upi', '{}'),
  'paid', 'correct amount confirms order');
select is(
  public.mark_order_paid((select r ->> 'order_number' from t_o1), 'cf_pay_2', 299800 - 29980, 'upi', '{}'),
  'already_paid', 'duplicate webhook is a no-op');
select is((select status::text from public.orders where id = (select (r ->> 'order_id')::uuid from t_o1)), 'confirmed', 'order confirmed');

-- Expiry + late payment ---------------------------------------------------------
create temp table t_o2 as
select public.place_order((select aarav from t_ids), '22222222-2222-4222-8222-222222222222',
  jsonb_build_array(jsonb_build_object('variant_id', (select jn100 from t_ids), 'qty', 2)),
  (select addr from t_ids), 'prepaid') as r;
select is((select stock from public.product_variants where sku = 'SG-JN-100'), 0, 'last units reserved');
select ok(public.expire_order_hold((select (r ->> 'order_id')::uuid from t_o2)), 'unpaid hold expires');
select is((select stock from public.product_variants where sku = 'SG-JN-100'), 2, 'expired hold restocks');
select ok(not public.expire_order_hold((select (r ->> 'order_id')::uuid from t_o2)), 'expiry is idempotent');
select is(
  public.mark_order_paid((select r ->> 'order_number' from t_o2), 'cf_pay_3', (select (r ->> 'total')::int from t_o2), 'card', '{}'),
  'paid', 'late payment re-reserves stock when available');
select is((select stock from public.product_variants where sku = 'SG-JN-100'), 0, 'stock taken again');

-- COD + cancel -------------------------------------------------------------------
create temp table t_o3 as
select public.place_order((select diya from t_ids), '33333333-3333-4333-8333-333333333333',
  jsonb_build_array(jsonb_build_object('variant_id', (select ma6 from t_ids), 'qty', 1)),
  (select addr from t_ids), 'cod') as r;
select is((select r ->> 'status' from t_o3), 'confirmed', 'COD order confirmed immediately');
select is((public.cancel_order((select (r ->> 'order_id')::uuid from t_o3), 'test') ->> 'refund_due')::int, 0, 'COD cancel has nothing to refund');
select is((select stock from public.product_variants where sku = 'SG-MA-6'), 80, 'cancel restocks');

-- Refunds ---------------------------------------------------------------------------
select throws_ok(
  format($$select public.create_refund(%L, 999999999, 'x', 'test')$$, (select (r ->> 'order_id')::uuid from t_o1)),
  'P0001', 'REFUND_EXCEEDS_PAID', 'cannot refund more than paid');
create temp table t_rf as
select * from public.create_refund((select (r ->> 'order_id')::uuid from t_o1), 299800 - 29980, 'test', 'test');
select lives_ok(
  format($$select public.apply_refund_status(%L, 'success', 'cf_rf_1', '{}')$$, (select refund_id from t_rf)),
  'refund status applied');
select is((select payment_status::text from public.orders where id = (select (r ->> 'order_id')::uuid from t_o1)), 'refunded', 'full refund marks order refunded');

-- RLS -------------------------------------------------------------------------------
set local role anon;
select ok((select count(*) from public.products) >= 16, 'anon reads active products');
select is((select count(*)::int from public.coupons), 0, 'anon cannot read coupons');
select throws_ok($$select public.quote_cart(null, '[]'::jsonb)$$, '42501', null, 'anon cannot call quote_cart directly');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select aarav from t_ids), 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.orders where user_id <> (select aarav from t_ids)), 0, 'user sees only own orders');
select throws_ok($$update public.profiles set role = 'admin' where id = auth.uid()$$, '42501', null, 'user cannot change own role');
select throws_ok(
  $$insert into public.orders (order_number, user_id, checkout_key, status, payment_method, shipping_address, subtotal, total)
    values ('X', auth.uid(), gen_random_uuid(), 'confirmed', 'cod', '{}', 1, 1)$$,
  '42501', null, 'user cannot insert orders');
select throws_ok(
  format($$select public.place_order(auth.uid(), gen_random_uuid(), '[]', %L, 'cod')$$, (select addr from t_ids)),
  '42501', null, 'user cannot call place_order directly');

insert into public.reviews (product_id, rating, title)
  values ((select id from public.products where slug = 'petal-mist'), 5, 'Lovely');
update public.reviews set status = 'approved' where product_id = (select id from public.products where slug = 'petal-mist');
select is((select status::text from public.reviews where product_id = (select id from public.products where slug = 'petal-mist')),
  'pending', 'author cannot approve own review');

reset role;
select * from finish();
rollback;
