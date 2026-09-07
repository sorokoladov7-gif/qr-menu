-- OS QR-Menu: align venue_integrations RLS with the manager access model used by the API.
-- The integrations API authorizes managers through manager_venues, so direct
-- authenticated access must use the same relationship instead of the older
-- manager_venue_permissions table.

drop policy if exists manager_select on public.venue_integrations;
drop policy if exists manager_insert on public.venue_integrations;
drop policy if exists manager_update on public.venue_integrations;
drop policy if exists manager_delete on public.venue_integrations;

drop policy if exists venue_integrations_manager_select on public.venue_integrations;
drop policy if exists venue_integrations_manager_insert on public.venue_integrations;
drop policy if exists venue_integrations_manager_update on public.venue_integrations;
drop policy if exists venue_integrations_manager_delete on public.venue_integrations;

create policy venue_integrations_manager_select
on public.venue_integrations for select to authenticated
using (
  exists (
    select 1 from public.manager_venues mv
    where mv.venue_id = venue_integrations.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::text
  )
);

create policy venue_integrations_manager_insert
on public.venue_integrations for insert to authenticated
with check (
  exists (
    select 1 from public.manager_venues mv
    where mv.venue_id = venue_integrations.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::text
  )
);

create policy venue_integrations_manager_update
on public.venue_integrations for update to authenticated
using (
  exists (
    select 1 from public.manager_venues mv
    where mv.venue_id = venue_integrations.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::text
  )
)
with check (
  exists (
    select 1 from public.manager_venues mv
    where mv.venue_id = venue_integrations.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::text
  )
);

create policy venue_integrations_manager_delete
on public.venue_integrations for delete to authenticated
using (
  exists (
    select 1 from public.manager_venues mv
    where mv.venue_id = venue_integrations.venue_id
      and mv.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'::text
  )
);
