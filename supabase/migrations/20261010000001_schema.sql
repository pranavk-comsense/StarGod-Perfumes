-- =============================================================================
-- Stargod Perfumes: core schema
-- Money is stored as integer paise everywhere (₹1 = 100). Never floats.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.user_role      as enum ('customer', 'admin');
create type public.gender         as enum ('men', 'women', 'unisex');
create type public.concentration  as enum ('parfum', 'edp', 'edt', 'edc', 'attar', 'body_mist');
create type public.note_tier      as enum ('top', 'heart', 'base');
create type public.order_status   as enum (
  'pending_payment', 'confirmed', 'processing', 'shipped', 'delivered',
  'cancelled', 'payment_failed', 'rto', 'returned'
);
create type public.payment_method as enum ('prepaid', 'cod');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.refund_status  as enum ('pending', 'success', 'failed');
create type public.coupon_type    as enum ('percent', 'flat', 'free_shipping');
create type public.review_status  as enum ('pending', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Generic updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  role        public.user_role not null default 'customer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1       text not null check (char_length(line1) between 3 and 200),
  line2       text check (char_length(line2) <= 200),
  landmark    text check (char_length(landmark) <= 120),
  city        text not null check (char_length(city) between 2 and 80),
  state       text not null check (char_length(state) between 2 and 80),
  pincode     text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Catalog
-- -----------------------------------------------------------------------------
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null,
  description  text,
  image_path   text,
  sort         int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name           text not null,
  tagline        text,
  description    text,
  gender         public.gender not null,
  concentration  public.concentration not null,
  is_gift_set    boolean not null default false,
  hsn_code       text not null default '33030090',
  gst_rate       numeric(4, 2) not null default 18 check (gst_rate >= 0 and gst_rate <= 28),
  is_active      boolean not null default true,
  is_featured    boolean not null default false,
  rating_avg     numeric(2, 1) not null default 0,
  rating_count   int not null default 0,
  search         tsvector generated always as (
                   setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
                   setweight(to_tsvector('english'::regconfig, coalesce(tagline, '')), 'B') ||
                   setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index products_search_idx on public.products using gin (search);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_gender_idx on public.products (gender) where is_active;
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_collections (
  product_id     uuid not null references public.products (id) on delete cascade,
  collection_id  uuid not null references public.collections (id) on delete cascade,
  sort           int not null default 0,
  primary key (product_id, collection_id)
);
create index product_collections_collection_idx on public.product_collections (collection_id);

create table public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  sku         text not null unique,
  size_ml     int not null check (size_ml > 0),
  label       text not null,                      -- e.g. "100 ml"
  price       int not null check (price > 0),     -- selling price, paise, GST inclusive
  mrp         int not null check (mrp > 0),
  stock       int not null default 0 check (stock >= 0),
  weight_g    int not null default 300 check (weight_g > 0),   -- packed weight for shipping
  length_cm   numeric(5, 1) not null default 10,
  breadth_cm  numeric(5, 1) not null default 10,
  height_cm   numeric(5, 1) not null default 15,
  is_active   boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (price <= mrp)
);
create index product_variants_product_idx on public.product_variants (product_id);
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  variant_id    uuid references public.product_variants (id) on delete set null,
  storage_path  text not null,     -- storage object path, or an absolute/root-relative URL
  alt           text,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id, sort);

create table public.notes (
  id      uuid primary key default gen_random_uuid(),
  name    text not null unique,
  family  text not null            -- Woody, Floral, Citrus, Oriental, Fresh, Gourmand, Spicy, Aquatic...
);

create table public.product_notes (
  product_id  uuid not null references public.products (id) on delete cascade,
  note_id     uuid not null references public.notes (id) on delete cascade,
  tier        public.note_tier not null,
  primary key (product_id, note_id, tier)
);
create index product_notes_note_idx on public.product_notes (note_id);

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  title        text check (char_length(title) <= 120),
  body         text check (char_length(body) <= 2000),
  is_verified  boolean not null default false,
  status       public.review_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, status, created_at desc);
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Shopping
-- -----------------------------------------------------------------------------
create table public.wishlist_items (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  variant_id  uuid not null references public.product_variants (id) on delete cascade,
  qty         int not null check (qty between 1 and 10),
  updated_at  timestamptz not null default now(),
  primary key (user_id, variant_id)
);
create trigger cart_items_updated_at before update on public.cart_items
  for each row execute function public.set_updated_at();

create table public.coupons (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description       text,
  type              public.coupon_type not null,
  value             int not null default 0 check (value >= 0),  -- percent (1-100) or paise
  max_discount      int check (max_discount > 0),               -- cap for percent coupons, paise
  min_order         int not null default 0 check (min_order >= 0),
  starts_at         timestamptz,
  ends_at           timestamptz,
  usage_limit       int check (usage_limit > 0),
  per_user_limit    int not null default 1 check (per_user_limit > 0),
  used_count        int not null default 0 check (used_count >= 0),
  first_order_only  boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (type <> 'percent' or value between 1 and 100)
);
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

create table public.store_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger store_settings_updated_at before update on public.store_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Orders & payments
-- -----------------------------------------------------------------------------
create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null unique,    -- also the Cashfree order_id
  user_id                uuid not null references public.profiles (id) on delete restrict,
  checkout_key           uuid not null unique,    -- client-generated, makes "Place order" idempotent
  status                 public.order_status not null,
  payment_method         public.payment_method not null,
  payment_status         public.payment_status not null default 'pending',
  shipping_address       jsonb not null,
  contact_email          text,
  subtotal               int not null check (subtotal >= 0),
  discount               int not null default 0 check (discount >= 0),
  shipping_fee           int not null default 0 check (shipping_fee >= 0),
  cod_fee                int not null default 0 check (cod_fee >= 0),
  total                  int not null check (total >= 0),
  gst_amount             int not null default 0 check (gst_amount >= 0),
  coupon_id              uuid references public.coupons (id) on delete set null,
  coupon_code            text,
  cf_payment_session_id  text,
  reserved_until         timestamptz,             -- prepaid stock hold expiry
  needs_refund           boolean not null default false,
  admin_note             text,
  paid_at                timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (total = subtotal - discount + shipping_fee + cod_fee)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_pending_hold_idx on public.orders (reserved_until) where status = 'pending_payment';
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  variant_id     uuid references public.product_variants (id) on delete set null,
  product_name   text not null,
  product_slug   text not null,
  variant_label  text not null,
  sku            text not null,
  image_path     text,
  unit_price     int not null check (unit_price >= 0),
  mrp            int not null check (mrp >= 0),
  qty            int not null check (qty > 0),
  gst_rate       numeric(4, 2) not null,
  line_total     int not null check (line_total >= 0)
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  public.order_status,
  to_status    public.order_status not null,
  note         text,
  actor        text,                       -- 'system', 'cashfree', 'shipmozo', or admin user id
  created_at   timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references public.coupons (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  order_id    uuid not null unique references public.orders (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  provider       text not null default 'cashfree',
  cf_payment_id  text not null unique,
  amount         int not null,
  status         text not null,              -- Cashfree payment_status: SUCCESS, FAILED, USER_DROPPED...
  method         text,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.refunds (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  refund_id     text not null unique,        -- our id, sent to Cashfree as refund_id
  cf_refund_id  text,
  amount        int not null check (amount > 0),
  reason        text,
  status        public.refund_status not null default 'pending',
  initiated_by  text not null,
  raw           jsonb,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);
create index refunds_order_idx on public.refunds (order_id);

-- -----------------------------------------------------------------------------
-- Shipping (provider-specific fields are kept in raw until the Shipmozo phase)
-- -----------------------------------------------------------------------------
create table public.shipments (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  provider       text not null default 'shipmozo',
  provider_ref   text,                        -- provider's order / shipment id
  awb            text unique,
  courier_name   text,
  courier_id     text,
  status         text not null default 'created',
  label_url      text,
  tracking_url   text,
  pickup_date    date,
  charges        int check (charges >= 0),
  weight_g       int,
  dims           jsonb,
  is_active      boolean not null default true,  -- false once cancelled
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index shipments_order_idx on public.shipments (order_id);
create unique index shipments_one_active_per_order on public.shipments (order_id) where is_active;
create trigger shipments_updated_at before update on public.shipments
  for each row execute function public.set_updated_at();

create table public.shipment_events (
  id           bigint generated always as identity primary key,
  shipment_id  uuid not null references public.shipments (id) on delete cascade,
  status       text not null,
  location     text,
  description  text,
  occurred_at  timestamptz not null,
  raw          jsonb,
  unique (shipment_id, occurred_at, status)
);

create table public.pincode_cache (
  pincode        text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  serviceable    boolean not null,
  cod_available  boolean not null default false,
  eta_days       int,
  city           text,
  state          text,
  checked_at     timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Ops
-- -----------------------------------------------------------------------------
create table public.webhook_events (
  id            bigint generated always as identity primary key,
  provider      text not null,
  event_key     text not null,
  type          text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  error         text,
  unique (provider, event_key)
);

create table public.inventory_movements (
  id          bigint generated always as identity primary key,
  variant_id  uuid not null references public.product_variants (id) on delete cascade,
  delta       int not null,
  reason      text not null check (reason in ('order', 'cancel', 'expired', 'restock', 'adjust', 'rereserve')),
  order_id    uuid references public.orders (id) on delete set null,
  actor       text,
  created_at  timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, created_at desc);
