-- Operations: stock adjustments, shipments, rate limiting, account anonymisation.
begin;
create extension if not exists pgtap with schema extensions;
-- Demo products are hidden in the seed; use them as fixtures for this transaction.
update public.products set is_active = true;
update public.collections set bogo = false;
select plan(19);

create temp table t as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin,
  '00000000-0000-4000-8000-000000000003'::uuid as diya,
  (select id from public.product_variants where sku = 'SG-MA-12') as v;

-- adjust_stock ----------------------------------------------------------------
select is(public.adjust_stock((select v from t), 5, 'restock', (select admin from t), 'PO-1'), 45, 'restock adds stock');
select throws_ok(format($$select public.adjust_stock(%L, -1000, 'adjust', %L)$$, (select v from t), (select admin from t)),
  'P0001', 'STOCK_WOULD_GO_NEGATIVE', 'stock never goes negative');
select throws_ok(format($$select public.adjust_stock(%L, 1, 'order', %L)$$, (select v from t), (select admin from t)),
  'P0001', 'INVALID_REASON', 'only restock/adjust allowed');
select is((select count(*)::int from public.inventory_movements where variant_id = (select v from t) and reason = 'restock'), 1, 'movement logged');
select is((select count(*)::int from public.admin_audit_log where action = 'inventory.adjusted'), 1, 'adjustment audited');

-- shipments ---------------------------------------------------------------------
create temp table o as select public.place_order((select diya from t), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('variant_id', (select v from t), 'qty', 1)),
  '{"name":"Diya Sharma","phone":"9876543210","line1":"5 Park St","city":"Kolkata","state":"West Bengal","pincode":"700016"}', 'cod') as r;
create temp table oid as select (r ->> 'order_id')::uuid as id from o;

select throws_ok(format($$select public.set_order_status(%L, 'delivered', 'test')$$, (select id from oid)),
  'P0001', null, 'cannot jump confirmed -> delivered');
select lives_ok(format($$select public.set_order_status(%L, 'processing', 'test')$$, (select id from oid)), 'confirmed -> processing');
create temp table s as select public.create_shipment((select id from oid), 'manual', 'Delhivery', 'AWB123456', 'https://track.example/AWB123456', 'test') as id;
select is((select status::text from public.orders where id = (select id from oid)), 'shipped', 'create_shipment marks order shipped');
select is((select count(*)::int from public.shipment_events where shipment_id = (select id from s)), 1, 'first tracking event recorded');
select throws_ok(format($$select public.create_shipment(%L, 'manual', 'X', 'AWB999', '', 'test')$$, (select id from oid)),
  'P0001', 'NOT_SHIPPABLE', 'cannot ship twice');
select throws_ok(format($$select public.cancel_order(%L, 'test')$$, (select id from oid)),
  'P0001', 'NOT_CANCELLABLE', 'shipped orders cannot be cancelled');
select lives_ok(format($$select public.add_shipment_event(%L, 'delivered', 'Kolkata', 'Delivered', now(), 'test')$$, (select id from s)), 'delivery event');
select is((select status::text from public.orders where id = (select id from oid)), 'delivered', 'delivery event marks order delivered');
select is((select payment_status::text from public.orders where id = (select id from oid)), 'paid', 'COD delivered = paid');

-- rate limit ----------------------------------------------------------------------
select ok(public.hit_rate_limit('t:key', 60, 2), 'hit 1 allowed');
select ok(public.hit_rate_limit('t:key', 60, 2), 'hit 2 allowed');
select ok(not public.hit_rate_limit('t:key', 60, 2), 'hit 3 blocked');

-- anonymize_user --------------------------------------------------------------------
select lives_ok(format($$select public.anonymize_user(%L)$$, (select diya from t)), 'user with only completed orders can be deleted');
select results_eq(
  format($$select full_name, email, (select count(*)::int from public.addresses where user_id = %L),
                  (select shipping_address ->> 'name' from public.orders where id = %L)
           from public.profiles where id = %L$$, (select diya from t), (select id from oid), (select diya from t)),
  $$values (null::text, null::text, 0, 'Deleted user'::text)$$,
  'profile, addresses and order PII anonymised');

select * from finish();
rollback;
