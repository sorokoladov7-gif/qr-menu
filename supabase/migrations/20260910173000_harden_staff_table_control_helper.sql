begin;

-- Canonical table-control policy: waiters always control tables;
-- cooks may control tables only when the venue has no active waiters.
-- Keep this helper independent from the caller's JWT role because all
-- consumer RPCs already validate the staff session/token before calling it.
create or replace function public.staff_can_control_tables(p_staff_type text, p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when p_staff_type = 'waiter' then
      exists (
        select 1 from public.venues v where v.id = p_venue_id
      )
    when p_staff_type = 'cook' then
      exists (
        select 1 from public.venues v where v.id = p_venue_id
      )
      and not exists (
        select 1
        from public.waiters w
        where w.venue_id = p_venue_id
          and w.is_active = true
      )
    else false
  end;
$$;

revoke execute on function public.staff_can_control_tables(text,uuid) from public, anon, authenticated;
grant execute on function public.staff_can_control_tables(text,uuid) to service_role;

commit;
