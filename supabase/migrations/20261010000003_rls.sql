-- =============================================================================
-- Stargod Perfumes: Row Level Security
-- Every table has RLS on. The service_role (server only) bypasses RLS; order,
-- payment and refund writes happen only through it and the functions above.
-- `(select auth.uid())` is wrapped so Postgres evaluates it once per query.
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.addresses            enable row level security;
alter table public.collections          enable row level security;
alter table public.products             enable row level security;
alter table public.product_collections  enable row level security;
alter table public.product_variants     enable row level security;
alter table public.product_images       enable row level security;
alter table public.notes                enable row level security;
alter table public.product_notes        enable row level security;
alter table public.reviews              enable row level security;
alter table public.wishlist_items       enable row level security;
alter table public.cart_items           enable row level security;
alter table public.coupons              enable row level security;
alter table public.coupon_redemptions   enable row level security;
alter table public.store_settings       enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments             enable row level security;
alter table public.refunds              enable row level security;
alter table public.shipments            enable row level security;
alter table public.shipment_events      enable row level security;
alter table public.pincode_cache        enable row level security;
alter table public.webhook_events       enable row level security;
alter table public.inventory_movements  enable row level security;

-- -----------------------------------------------------------------------------
-- Profiles: users read/update their own; only name & phone are editable.
-- -----------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Addresses, wishlist, cart: owner-only
-- -----------------------------------------------------------------------------
create policy "addresses: owner all" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "addresses: admin read" on public.addresses
  for select to authenticated using ((select public.is_admin()));

create policy "wishlist: owner all" on public.wishlist_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "cart: owner all" on public.cart_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Catalog: public reads active rows; admins manage everything.
-- -----------------------------------------------------------------------------
create policy "collections: public read active" on public.collections
  for select to anon, authenticated using (is_active);
create policy "collections: admin all" on public.collections
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "products: public read active" on public.products
  for select to anon, authenticated using (is_active);
create policy "products: admin all" on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_collections: public read" on public.product_collections
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "product_collections: admin all" on public.product_collections
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "variants: public read active" on public.product_variants
  for select to anon, authenticated using (
    is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "variants: admin all" on public.product_variants
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "images: public read" on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy "images: admin all" on public.product_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "notes: public read" on public.notes
  for select to anon, authenticated using (true);
create policy "notes: admin all" on public.notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "product_notes: public read" on public.product_notes
  for select to anon, authenticated using (true);
create policy "product_notes: admin all" on public.product_notes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Reviews: approved are public; authors see/edit their own; admins moderate.
-- Customers may only set product, rating, title and body; status and the
-- verified flag are controlled by triggers / admins.
-- -----------------------------------------------------------------------------
create policy "reviews: public read approved" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "reviews: author read own" on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reviews: author insert" on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy "reviews: author update" on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "reviews: author delete" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "reviews: admin all" on public.reviews
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke insert, update on public.reviews from anon, authenticated;
grant insert (product_id, rating, title, body) on public.reviews to authenticated;
grant update (rating, title, body, status) on public.reviews to authenticated;
-- `status` is grantable for admin moderation; the author-update trigger resets it
-- to 'pending' for non-admins, so authors can't approve themselves.

-- -----------------------------------------------------------------------------
-- Coupons & settings: no client access (validated through the server).
-- Admins can read/manage via RLS; writes from the admin panel use the server.
-- -----------------------------------------------------------------------------
create policy "coupons: admin all" on public.coupons
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "coupon_redemptions: admin read" on public.coupon_redemptions
  for select to authenticated using ((select public.is_admin()));
create policy "store_settings: admin all" on public.store_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Orders & related: owners read; nobody writes from the client.
-- -----------------------------------------------------------------------------
create policy "orders: owner read" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "order_items: owner read" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "order_status_history: owner read" on public.order_status_history
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "shipments: owner read" on public.shipments
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "shipment_events: owner read" on public.shipment_events
  for select to authenticated using (
    exists (select 1 from public.shipments s join public.orders o on o.id = s.order_id
             where s.id = shipment_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

create policy "payments: admin read" on public.payments
  for select to authenticated using ((select public.is_admin()));
create policy "refunds: owner read" on public.refunds
  for select to authenticated using (
    exists (select 1 from public.orders o
             where o.id = order_id and (o.user_id = (select auth.uid()) or (select public.is_admin()))));

revoke insert, update, delete on
  public.orders, public.order_items, public.order_status_history, public.payments,
  public.refunds, public.shipments, public.shipment_events, public.coupon_redemptions
from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Ops tables: admin read only.
-- -----------------------------------------------------------------------------
create policy "webhook_events: admin read" on public.webhook_events
  for select to authenticated using ((select public.is_admin()));
create policy "inventory_movements: admin read" on public.inventory_movements
  for select to authenticated using ((select public.is_admin()));
create policy "pincode_cache: public read" on public.pincode_cache
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.webhook_events, public.inventory_movements, public.pincode_cache
from anon, authenticated;
