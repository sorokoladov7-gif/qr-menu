begin;

create or replace function public.manager_ensure_subscription()
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_sub public.subscriptions;
  v_venue public.venues;
  v_plan text := 'start';
  v_end timestamptz := now() + interval '10 days';
begin
  if v_user_id is null then raise exception 'auth_required'; end if;
  select role into v_role from public.profiles where id=v_user_id;
  if v_role <> 'manager' then raise exception 'manager_required'; end if;

  select * into v_sub from public.subscriptions
  where manager_id=v_user_id and venue_id is null
  order by created_at desc limit 1;
  if v_sub.id is not null then return v_sub; end if;

  select v.* into v_venue
  from public.venues v join public.manager_venues mv on mv.venue_id=v.id
  where mv.manager_id=v_user_id order by v.created_at asc limit 1;

  if v_venue.id is not null then
    v_plan := coalesce(v_venue.plan,'start');
    if v_venue.subscription_end is not null and v_venue.subscription_end > now() then v_end := v_venue.subscription_end; end if;
  end if;

  insert into public.subscriptions(manager_id,venue_id,plan_id,status,current_period_end)
  values(v_user_id,null,v_plan,case when v_end>now()+interval '9 days' then 'active' else 'trialing' end,v_end)
  on conflict (manager_id) where venue_id is null do nothing;

  select * into v_sub from public.subscriptions
  where manager_id=v_user_id and venue_id is null
  order by created_at desc limit 1;
  return v_sub;
end;
$$;

grant execute on function public.manager_ensure_subscription() to authenticated;
revoke execute on function public.manager_ensure_subscription() from anon, public;

commit;
