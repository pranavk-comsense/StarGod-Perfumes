-- -----------------------------------------------------------------------------
-- Return pickups (customer → store) booked through Shipmozo. Kept apart from
-- shipments so an order's forward shipment stays its one active shipment.
-- Restocking still happens when staff mark the order "returned".
-- -----------------------------------------------------------------------------
create table public.return_shipments (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  provider_ref      text not null unique,          -- Shipmozo order id, e.g. SG-1001-RET
  awb               text unique,
  courier_name      text,
  status            text not null default 'requested',
  reason            text,
  customer_request  text not null check (customer_request in ('REFUND', 'EXCHANGE')),
  comment           text,
  is_active         boolean not null default true,
  created_by        text,
  raw               jsonb,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index return_shipments_order_idx on public.return_shipments (order_id);
create trigger return_shipments_updated_at before update on public.return_shipments
  for each row execute function public.set_updated_at();

alter table public.return_shipments enable row level security;
revoke all on public.return_shipments from anon, authenticated;
