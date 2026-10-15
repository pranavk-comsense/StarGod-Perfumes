-- -----------------------------------------------------------------------------
-- Shipmozo: cancelling a booked shipment and tracking sync bookkeeping.
-- -----------------------------------------------------------------------------
alter table public.shipments add column if not exists last_synced_at timestamptz;
create index if not exists shipments_sync_idx on public.shipments (last_synced_at nulls first)
  where is_active and provider = 'shipmozo';

-- Cancels the active shipment (after the courier booking was cancelled) and puts
-- the order back to "packed" so it can be re-booked or cancelled.
create or replace function public.cancel_shipment(
  p_shipment_id  uuid,
  p_actor        text,
  p_reason       text default null
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
   where s.id = p_shipment_id and s.is_active
     for update of s, o;
  if v_order_id is null then
    raise exception 'SHIPMENT_NOT_FOUND';
  end if;
  if v_order_status <> 'shipped' then
    raise exception 'NOT_CANCELLABLE';
  end if;

  update public.shipments set is_active = false, status = 'cancelled' where id = p_shipment_id;
  insert into public.shipment_events (shipment_id, status, description, occurred_at)
  values (p_shipment_id, 'cancelled', coalesce(nullif(trim(p_reason), ''), 'Shipment cancelled'), now());

  perform set_config('app.actor', p_actor, true);
  perform set_config('app.status_note', coalesce(nullif(trim(p_reason), ''), 'Shipment cancelled'), true);
  update public.orders set status = 'processing' where id = v_order_id;
end;
$$;

revoke execute on function public.cancel_shipment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancel_shipment(uuid, text, text) to service_role;
