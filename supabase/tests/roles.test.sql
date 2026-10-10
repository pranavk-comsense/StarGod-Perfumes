-- Role & permission tests (customer / staff / admin). Run with: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
-- Demo products are hidden in the seed; use them as fixtures for this transaction.
update public.products set is_active = true;
update public.collections set bogo = false;
select plan(17);

create temp table t_u as select
  '00000000-0000-4000-8000-000000000001'::uuid as admin,
  '00000000-0000-4000-8000-000000000005'::uuid as staff,
  '00000000-0000-4000-8000-000000000002'::uuid as aarav,
  '00000000-0000-4000-8000-000000000003'::uuid as diya;
grant select on t_u to authenticated;

-- an order for diya, so staff has something to see
select public.place_order((select diya from t_u), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('variant_id', (select id from public.product_variants where sku = 'SG-MA-6'), 'qty', 1)),
  '{"name":"Diya Sharma","phone":"9876543210","line1":"5 Park St","city":"Kolkata","state":"West Bengal","pincode":"700016"}', 'cod');

select is((select role::text from public.profiles where id = (select staff from t_u)), 'staff', 'seed: staff role');
select isnt((select terms_accepted_at from public.profiles where id = (select aarav from t_u)), null, 'seed: terms accepted');

-- signup metadata is copied into the profile
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000aa', 'authenticated', 'authenticated',
        'new@stargod.test', '{"full_name":"New User","phone":"9123456780","terms_accepted":true,"marketing_opt_in":true}', now(), now());
select results_eq(
  $$select full_name, phone, marketing_opt_in, terms_accepted_at is not null, role::text from public.profiles where email = 'new@stargod.test'$$,
  $$values ('New User'::text, '9123456780'::text, true, true, 'customer'::text)$$,
  'signup metadata -> profile, default role customer');

-- STAFF -----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select staff from t_u), 'role', 'authenticated')::text, true);
select ok(public.is_staff(), 'staff: is_staff()');
select ok(not public.is_admin(), 'staff: not admin');
select ok((select count(*) from public.orders) >= 1, 'staff: reads all orders');
select ok((select count(*) from public.profiles) > 1, 'staff: reads customer profiles');
select is((select count(*)::int from public.coupons), 0, 'staff: cannot read coupons');
select is((select count(*)::int from public.payments), 0, 'staff: cannot read payments');
select is((select count(*)::int from public.store_settings), 0, 'staff: cannot read settings');
update public.products set name = 'Hacked' where slug = 'mitti-attar';
reset role;
select is((select name from public.products where slug = 'mitti-attar'), 'Mitti Attar', 'staff: cannot edit products (RLS: 0 rows updated)');

-- CUSTOMER ----------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select aarav from t_u), 'role', 'authenticated')::text, true);
select ok(not public.is_staff(), 'customer: not staff');
select is((select count(*)::int from public.profiles), 1, 'customer: reads only own profile');
select throws_ok($$select public.set_user_role(auth.uid(), auth.uid(), 'admin')$$, '42501', null, 'customer: cannot call set_user_role');
reset role;

-- set_user_role (server) ----------------------------------------------------------
select throws_ok(
  format($$select public.set_user_role(%L, %L, 'customer')$$, (select admin from t_u), (select admin from t_u)),
  'P0001', 'CANNOT_CHANGE_OWN_ROLE', 'admin cannot demote themselves');
select lives_ok(
  format($$select public.set_user_role(%L, %L, 'staff')$$, (select admin from t_u), (select aarav from t_u)),
  'admin promotes customer to staff');
select is(
  (select details ->> 'to' from public.admin_audit_log where entity_id = (select aarav from t_u)::text and action = 'user.role_changed'),
  'staff', 'role change is audited');

select * from finish();
rollback;
