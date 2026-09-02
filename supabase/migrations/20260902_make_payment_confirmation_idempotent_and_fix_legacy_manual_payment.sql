-- QR Menu production synchronization.
-- Makes manager payment confirmation idempotent and fixes the legacy manual-payment
-- path so it renews the canonical manager-owned subscription correctly.

begin;

create or replace function public.admin_confirm_manager_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_payment public.payments%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_sub public.subscriptions%rowtype;
  v_base timestamptz;
  v_end timestamptz;
begin
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) into v_admin;

  if not v_admin then
    raise exception 'not_authorized';
  end if;

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'payment_already_processed:%', v_payment.status;
  end if;

  select *
    into v_plan
  from public.subscription_plans
  where id = v_payment.plan_id
    and active = true;

  if not found then
    raise exception 'plan_not_found_or_inactive';
  end if;

  select *
    into v_sub
  from public.subscriptions
  where manager_id = v_payment.manager_id
    and venue_id is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.subscriptions (
      manager_id,
      venue_id,
      plan_id,
      status,
      current_period_end
    ) values (
      v_payment.manager_id,
      null,
      v_plan.id,
      'active',
      now() + interval '1 month'
    )
    returning * into v_sub;
  else
    v_base := greatest(coalesce(v_sub.current_period_end, now()), now());
    v_end := v_base + interval '1 month';

    update public.subscriptions
    set plan_id = v_plan.id,
        status = 'active',
        current_period_end = v_end
    where id = v_sub.id
    returning * into v_sub;
  end if;

  update public.payments
  set status = 'confirmed',
      processed_at = coalesce(processed_at, now())
  where id = p_payment_id;

  return jsonb_build_object(
    'ok', true,
    'payment_id', p_payment_id,
    'manager_id', v_payment.manager_id,
    'plan_id', v_plan.id,
    'subscription_id', v_sub.id,
    'current_period_end', v_sub.current_period_end,
    'status', v_sub.status
  );
end;
$$;

revoke execute on function public.admin_confirm_manager_payment(uuid) from public, anon;
grant execute on function public.admin_confirm_manager_payment(uuid) to authenticated, service_role;

create or replace function public.admin_confirm_manual_payment(p_payment_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_payment public.payments%rowtype;
  v_plan public.subscription_plans%rowtype;
  v_sub public.subscriptions%rowtype;
  v_base timestamptz;
  v_end timestamptz;
begin
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  ) into v_admin;

  if not v_admin then
    raise exception 'not_authorized';
  end if;

  select *
    into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status <> 'pending' then
    raise exception 'payment_already_processed:%', v_payment.status;
  end if;

  select *
    into v_plan
  from public.subscription_plans
  where id = v_payment.plan_id
    and active = true;

  if not found then
    raise exception 'plan_not_found_or_inactive';
  end if;

  select *
    into v_sub
  from public.subscriptions
  where manager_id = v_payment.manager_id
    and venue_id is null
  order by created_at desc
  limit 1
  for update;

  if not found then
    insert into public.subscriptions (
      manager_id,
      venue_id,
      plan_id,
      status,
      current_period_end
    ) values (
      v_payment.manager_id,
      null,
      v_plan.id,
      'active',
      now() + interval '1 month'
    )
    returning * into v_sub;
  else
    v_base := greatest(coalesce(v_sub.current_period_end, now()), now());
    v_end := v_base + interval '1 month';

    update public.subscriptions
    set plan_id = v_plan.id,
        status = 'active',
        current_period_end = v_end
    where id = v_sub.id
    returning * into v_sub;
  end if;

  update public.payments
  set status = 'confirmed',
      processed_at = coalesce(processed_at, now())
  where id = p_payment_id;

  return v_sub;
end;
$$;

revoke execute on function public.admin_confirm_manual_payment(uuid) from public, anon, authenticated;
grant execute on function public.admin_confirm_manual_payment(uuid) to service_role;

commit;
