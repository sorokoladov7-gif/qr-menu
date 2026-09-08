begin;

-- Both policies are authenticated-only and differ only by admin vs manager-of-venue.
-- Merge them into one policy without changing effective access.
drop policy if exists table_sessions_admin_all on public.table_sessions;
drop policy if exists table_sessions_manager_all on public.table_sessions;
create policy table_sessions_staff_all on public.table_sessions
  as permissive
  for all
  to authenticated
  using (is_admin() or is_manager_of(venue_id))
  with check (is_admin() or is_manager_of(venue_id));

-- Same consolidation for venue_tables: preserve admin and manager access while
-- eliminating two permissive policies for the same role/command set.
drop policy if exists venue_tables_admin_all on public.venue_tables;
drop policy if exists venue_tables_manager_all on public.venue_tables;
create policy venue_tables_staff_all on public.venue_tables
  as permissive
  for all
  to authenticated
  using (is_admin() or is_manager_of(venue_id))
  with check (is_admin() or is_manager_of(venue_id));

commit;
