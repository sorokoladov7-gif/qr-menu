drop policy if exists manager_delete on public.venue_integrations;
drop policy if exists venue_integrations_manager_delete on public.venue_integrations;
drop policy if exists manager_insert on public.venue_integrations;
drop policy if exists venue_integrations_manager_insert on public.venue_integrations;
drop policy if exists manager_select on public.venue_integrations;
drop policy if exists venue_integrations_manager_select on public.venue_integrations;
drop policy if exists manager_update on public.venue_integrations;
drop policy if exists venue_integrations_manager_update on public.venue_integrations;

create policy venue_integrations_manager_delete on public.venue_integrations
for delete to authenticated
using (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venue_integrations.venue_id and mv.manager_id=auth.uid())
  or exists (select 1 from public.manager_venue_permissions p where p.venue_id=venue_integrations.venue_id and p.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

create policy venue_integrations_manager_insert on public.venue_integrations
for insert to authenticated
with check (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venue_integrations.venue_id and mv.manager_id=auth.uid())
  or exists (select 1 from public.manager_venue_permissions p where p.venue_id=venue_integrations.venue_id and p.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

create policy venue_integrations_manager_select on public.venue_integrations
for select to authenticated
using (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venue_integrations.venue_id and mv.manager_id=auth.uid())
  or exists (select 1 from public.manager_venue_permissions p where p.venue_id=venue_integrations.venue_id and p.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

create policy venue_integrations_manager_update on public.venue_integrations
for update to authenticated
using (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venue_integrations.venue_id and mv.manager_id=auth.uid())
  or exists (select 1 from public.manager_venue_permissions p where p.venue_id=venue_integrations.venue_id and p.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
)
with check (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venue_integrations.venue_id and mv.manager_id=auth.uid())
  or exists (select 1 from public.manager_venue_permissions p where p.venue_id=venue_integrations.venue_id and p.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);

drop policy if exists manager_update_own_venues on public.venues;
drop policy if exists venues_manager_update on public.venues;
create policy venues_manager_update on public.venues
for update to authenticated
using (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venues.id and mv.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.venue_id=venues.id)
  or is_admin()
)
with check (
  exists (select 1 from public.manager_venues mv where mv.venue_id=venues.id and mv.manager_id=auth.uid())
  or exists (select 1 from public.profiles p where p.id=auth.uid() and p.venue_id=venues.id)
  or is_admin()
);
