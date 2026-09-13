begin;

-- Manager operational actions use the canonical manager_can_manage_venue boundary.
-- The browser mutation bridge calls the REST API for these two workflows, so the
-- underlying tables must explicitly allow the authenticated manager to mutate
-- only rows belonging to a venue they manage.

alter table public.cooks enable row level security;
alter table public.couriers enable row level security;
alter table public.waiters enable row level security;
alter table public.orders enable row level security;

-- Staff deletion is intentionally limited to the manager's own venue.
drop policy if exists manager_operational_cooks_delete on public.cooks;
create policy manager_operational_cooks_delete
on public.cooks for delete to authenticated
using (public.manager_can_manage_venue(venue_id));

drop policy if exists manager_operational_couriers_delete on public.couriers;
create policy manager_operational_couriers_delete
on public.couriers for delete to authenticated
using (public.manager_can_manage_venue(venue_id));

drop policy if exists manager_operational_waiters_delete on public.waiters;
create policy manager_operational_waiters_delete
on public.waiters for delete to authenticated
using (public.manager_can_manage_venue(venue_id));

-- Manager order status changes are venue-scoped. The existing UI only sends
-- status/cooking_started_at/ready_at, but the policy deliberately validates
-- the complete row's venue ownership on UPDATE.
drop policy if exists manager_operational_orders_select on public.orders;
create policy manager_operational_orders_select
on public.orders for select to authenticated
using (public.manager_can_manage_venue(venue_id));

drop policy if exists manager_operational_orders_update on public.orders;
create policy manager_operational_orders_update
on public.orders for update to authenticated
using (public.manager_can_manage_venue(venue_id))
with check (public.manager_can_manage_venue(venue_id));

commit;
