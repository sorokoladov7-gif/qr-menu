-- Serialize manager-level entitlement mutations so concurrent admin/payment
-- operations cannot overwrite each other's plan or subscription period.

begin;

create or replace function public.admin_set_manager_plan(
  p_manager_id uuid,
  p_plan_id text
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_plan public.plans;
  v_sub public.subscriptions;
  v_end timestamptz;
begin
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into v_admin;
  if not v_admin then raise exception 'not_authorized'; end if;
  if p_manager_id is null then raise exception 'manager_required'; end if;

  -- One entitlement transaction at a time per manager, including creation of
  -- the first subscription row.
  perform pg_advisory_xact_lock(hashtextextended(p_manager_id::text, 0));

  select * into v_plan
  from public.plans
  where id = trim(p_plan_id) and is_active = true;
  if v_plan.id is null then raise exception 'plan_not_found'; end if;

  select * into v_sub
  from public.subscriptions
  where manager_id = p_manager_id and venue_id is null
  order by created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    v_end := now() + interval '10 days';
    insert into public.subscriptions(manager_id, venue_id, plan_id, status, current_period_end)
    values(p_manager_id, null, p_plan_id, 'trialing', v_end)
    returning * into v_sub;
  else
    update public.subscriptions
    set plan_id = p_plan_id
    where id = v_sub.id
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

grant execute on function public.admin_set_manager_plan(uuid,text) to authenticated, service_role;
revoke execute on function public.admin_set_manager_plan(uuid,text) from anon;

create or replace function public.admin_extend_manager_subscription(
  p_manager_id uuid,
  p_days integer
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_sub public.subscriptions;
  v_end timestamptz;
begin
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into v_admin;
  if not v_admin then raise exception 'not_authorized'; end if;
  if p_manager_id is null then raise exception 'manager_required'; end if;
  if p_days not between 1 and 365 then raise exception 'invalid_days'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_manager_id::text, 0));

  select * into v_sub
  from public.subscriptions
  where manager_id = p_manager_id and venue_id is null
  order by created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    insert into public.subscriptions(manager_id, venue_id, plan_id, status, current_period_end)
    values(p_manager_id, null, 'start', 'active', now() + make_interval(days => p_days))
    returning * into v_sub;
  else
    v_end := greatest(coalesce(v_sub.current_period_end, now()), now()) + make_interval(days => p_days);
    update public.subscriptions
    set status = 'active', current_period_end = v_end
    where id = v_sub.id
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

grant execute on function public.admin_extend_manager_subscription(uuid,integer) to authenticated, service_role;
revoke execute on function public.admin_extend_manager_subscription(uuid,integer) from anon;

commit;
