-- QR Menu SaaS entitlement hardening.
-- Canonical model: manager -> one manager-owned subscription -> many venues.
-- Managers must not mutate subscription entitlement fields directly.

begin;

-- Remove manager-side direct subscription mutations.
drop policy if exists "manager create own subscription v2" on public.subscriptions;
drop policy if exists "manager update own subscription v2" on public.subscriptions;

-- Preserve manager read access only to their own subscription.
drop policy if exists "manager read own subscriptions v2" on public.subscriptions;
create policy "manager read own subscriptions v2"
  on public.subscriptions
  for select to authenticated
  using (manager_id = auth.uid());

-- Canonical admin RPC: assign/change a manager plan.
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
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin') into v_admin;
  if not v_admin then raise exception 'not_authorized'; end if;

  select * into v_plan from public.plans where id=p_plan_id and is_active=true;
  if v_plan.id is null then raise exception 'plan_not_found'; end if;

  select * into v_sub
  from public.subscriptions
  where manager_id=p_manager_id and venue_id is null
  order by created_at desc
  limit 1;

  if v_sub.id is null then
    v_end := now() + interval '10 days';
    insert into public.subscriptions(manager_id, venue_id, plan_id, status, current_period_end)
    values(p_manager_id, null, p_plan_id, 'trialing', v_end)
    returning * into v_sub;
  else
    update public.subscriptions
    set plan_id=p_plan_id
    where id=v_sub.id
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

grant execute on function public.admin_set_manager_plan(uuid,text) to authenticated, service_role;
revoke execute on function public.admin_set_manager_plan(uuid,text) from anon;

-- Canonical admin RPC: extend manager subscription.
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
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin') into v_admin;
  if not v_admin then raise exception 'not_authorized'; end if;
  if p_days not between 1 and 365 then raise exception 'invalid_days'; end if;

  select * into v_sub
  from public.subscriptions
  where manager_id=p_manager_id and venue_id is null
  order by created_at desc
  limit 1;

  if v_sub.id is null then
    insert into public.subscriptions(manager_id, venue_id, plan_id, status, current_period_end)
    values(p_manager_id, null, 'start', 'active', now() + make_interval(days => p_days))
    returning * into v_sub;
  else
    v_end := greatest(coalesce(v_sub.current_period_end, now()), now()) + make_interval(days => p_days);
    update public.subscriptions
    set status='active', current_period_end=v_end
    where id=v_sub.id
    returning * into v_sub;
  end if;

  return v_sub;
end;
$$;

grant execute on function public.admin_extend_manager_subscription(uuid,integer) to authenticated, service_role;
revoke execute on function public.admin_extend_manager_subscription(uuid,integer) from anon;

commit;
