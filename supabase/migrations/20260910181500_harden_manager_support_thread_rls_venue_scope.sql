begin;

drop policy if exists manager_support_threads_manager on public.manager_support_threads;

create policy manager_support_threads_manager_select
on public.manager_support_threads
for select
to authenticated
using (manager_id = auth.uid());

create policy manager_support_threads_manager_insert
on public.manager_support_threads
for insert
to authenticated
with check (
  manager_id = auth.uid()
  and (venue_id is null or public.is_manager_of(venue_id))
);

create policy manager_support_threads_manager_update
on public.manager_support_threads
for update
to authenticated
using (manager_id = auth.uid())
with check (
  manager_id = auth.uid()
  and (venue_id is null or public.is_manager_of(venue_id))
);

create policy manager_support_threads_manager_delete
on public.manager_support_threads
for delete
to authenticated
using (manager_id = auth.uid());

commit;
