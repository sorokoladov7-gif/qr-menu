begin;

-- Managers must never self-assign to an arbitrary venue.
drop policy if exists "manager insert own links" on public.manager_venues;

commit;
