-- Compatibility wrapper for the existing admin UI.
-- Keeps subscription ownership canonical: manager -> one manager-owned subscription.

create or replace function public.admin_extend_manager_subscription(
  p_manager_id uuid,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'not_authorized';
  end if;

  select plan_id
    into v_plan_id
  from public.subscriptions
  where manager_id = p_manager_id
    and venue_id is null
  order by created_at desc
  limit 1;

  if v_plan_id is null then
    select coalesce(v.plan, 'start')
      into v_plan_id
    from public.venues v
    join public.manager_venues mv on mv.venue_id = v.id
    where mv.manager_id = p_manager_id
    order by v.created_at asc nulls last
    limit 1;
  end if;

  v_plan_id := coalesce(v_plan_id, 'start');

  return public.admin_set_manager_plan(
    p_manager_id,
    v_plan_id,
    greatest(coalesce(p_days, 30), 0)
  );
end;
$$;

grant execute on function public.admin_extend_manager_subscription(uuid, integer) to authenticated;
revoke execute on function public.admin_extend_manager_subscription(uuid, integer) from anon;
