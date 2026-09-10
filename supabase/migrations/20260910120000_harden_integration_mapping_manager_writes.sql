begin;

create policy "integration_item_mappings_manager_insert"
on public.integration_item_mappings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.manager_venues mv
    where mv.manager_id = auth.uid()
      and mv.venue_id = integration_item_mappings.venue_id
  )
  and public.manager_has_permission(integration_item_mappings.venue_id, 'edit_menu')
);

create policy "integration_item_mappings_manager_update"
on public.integration_item_mappings
for update
to authenticated
using (
  exists (
    select 1
    from public.manager_venues mv
    where mv.manager_id = auth.uid()
      and mv.venue_id = integration_item_mappings.venue_id
  )
  and public.manager_has_permission(integration_item_mappings.venue_id, 'edit_menu')
)
with check (
  exists (
    select 1
    from public.manager_venues mv
    where mv.manager_id = auth.uid()
      and mv.venue_id = integration_item_mappings.venue_id
  )
  and public.manager_has_permission(integration_item_mappings.venue_id, 'edit_menu')
);

commit;
