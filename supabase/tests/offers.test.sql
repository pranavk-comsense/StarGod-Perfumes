-- Buy 1 Get 1 within Silver / Golden collections (launch catalog).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

create temp table v as select
  (select id from public.product_variants where sku = 'SG-SV-QST-100') as s1,  -- Silver ₹1,455
  (select id from public.product_variants where sku = 'SG-SV-HLR-100') as s2,  -- Silver ₹1,455
  (select id from public.product_variants where sku = 'SG-GD-WMK-100') as g1,  -- Golden ₹1,855
  (select id from public.product_variants where sku = 'SG-GD-IRW-100') as g2;  -- Golden ₹1,855

create function pg_temp.q(items jsonb, coupon text default null, method public.payment_method default 'prepaid', uid uuid default null)
returns jsonb language sql as $$ select public.quote_cart(uid, items, coupon, method) $$;
create function pg_temp.i(variadic pairs text[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('variant_id', pairs[k], 'qty', pairs[k + 1]::int))
  from generate_series(1, array_length(pairs, 1), 2) k $$;

select is((pg_temp.q(pg_temp.i((select s1::text from v), '1', (select s2::text from v), '1')) ->> 'offer_discount')::int, 145500,
  'two Silver: one free');
select is((pg_temp.q(pg_temp.i((select s1::text from v), '1', (select s2::text from v), '1')) ->> 'total')::int, 145500,
  'two Silver: pay ₹1,455 total, free shipping');
select is((pg_temp.q(pg_temp.i((select s1::text from v), '2')) ->> 'offer_discount')::int, 145500,
  'two of the same Silver perfume: one free');
select is((pg_temp.q(pg_temp.i((select s1::text from v), '1', (select g1::text from v), '1')) ->> 'offer_discount')::int, 0,
  'Silver + Golden do not combine');
select is((pg_temp.q(pg_temp.i((select s1::text from v), '3')) ->> 'offer_discount')::int, 145500,
  'three Silver: only one free');
select is((pg_temp.q(pg_temp.i((select s1::text from v), '3')) -> 'offers' -> 0 ->> 'add_one_more')::boolean, true,
  'odd count prompts to add one more');
select is((pg_temp.q(pg_temp.i((select g1::text from v), '1', (select g2::text from v), '1', (select s1::text from v), '1')) ->> 'offer_discount')::int, 185500,
  'two Golden + one Silver: one Golden free');
select is(
  pg_temp.q(pg_temp.i((select s1::text from v), '1', (select s2::text from v), '1'), 'FLAT200', 'prepaid', '00000000-0000-4000-8000-000000000002') ->> 'coupon_error',
  'Add items worth ₹44 more to use this coupon.',
  'coupon minimum applies to the amount after the offer');
select is(
  (pg_temp.q(pg_temp.i((select s1::text from v), '1', (select s2::text from v), '1'), 'WELCOME10', 'prepaid', '00000000-0000-4000-8000-000000000002') ->> 'discount')::int,
  14550, 'percent coupon is calculated on the amount after the offer');

create temp table o as select public.place_order('00000000-0000-4000-8000-000000000002', gen_random_uuid(),
  pg_temp.i((select g1::text from v), '1', (select g2::text from v), '1'),
  '{"name":"Aarav Mehta","phone":"9876543210","line1":"12 MG Road","city":"Pune","state":"Maharashtra","pincode":"411001"}', 'cod') as r;
select results_eq(
  format($$select offer_discount, total from public.orders where id = %L$$, (select (r ->> 'order_id')::uuid from o)),
  $$values (185500, 185500 + 4900)$$,
  'order stores the offer discount; total = 2 × ₹1,855 − ₹1,855 + COD fee');

select * from finish();
rollback;
