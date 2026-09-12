-- QR Menu payment/entitlement runtime hardening.
-- Canonical source of plans is public.plans. Admin payment confirmation must
-- activate the manager-owned subscription through admin_set_manager_plan and
-- must be idempotent under concurrent confirmation attempts, including races
-- with the YooKassa webhook path.

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
  v_sub public.subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_base timestamptz;
  v_end timestamptz;
  v_paid_at timestamptz;
begin
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_admin;

  if not v_admin then
    raise exception 'not_authorized';
  end if;

  -- Serialize confirmation of this exact payment. A second concurrent caller
  -- therefore observes the terminal payment status instead of re-processing it.
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'payment_not_found';
  end if;

  -- The payment row is also the manual-confirmation idempotency marker.
  if v_payment.status <> 'pending' then
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'payment_id', p_payment_id,
      'status', v_payment.status
    );
  end if;

  select * into v_plan
  from public.plans
  where id = v_payment.plan_id
    and is_active = true;

  if not found then
    raise exception 'plan_not_found_or_inactive';
  end if;

  -- Lock the canonical manager subscription before deciding whether the
  -- payment has already been granted by the automatic YooKassa webhook.
  select * into v_sub
  from public.subscriptions
  where manager_id = v_payment.manager_id
    and venue_id is null
  order by created_at desc
  limit 1
  for update;

  if v_sub.id is not null
     and v_sub.payment_id = p_payment_id
     and v_sub.payment_status = 'paid'
     and v_sub.paid_at is not null then
    update public.payments
    set status = 'confirmed',
        processed_at = coalesce(processed_at, v_sub.paid_at, now())
    where id = p_payment_id
      and status = 'pending';

    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'payment_id', p_payment_id,
      'subscription_id', v_sub.id,
      'current_period_end', v_sub.current_period_end,
      'status', 'confirmed'
    );
  end if;

  -- Keep plan selection in the canonical admin entitlement RPC.
  select * into v_sub
  from public.admin_set_manager_plan(v_payment.manager_id, v_plan.id::text);

  -- Serialize the final entitlement update as well. This protects the
  -- subscription state when the automatic webhook is concurrently claiming
  -- the same payment.
  select * into v_sub
  from public.subscriptions
  where id = v_sub.id
  for update;

  if v_sub.payment_id = p_payment_id
     and v_sub.payment_status = 'paid'
     and v_sub.paid_at is not null then
    update public.payments
    set status = 'confirmed',
        processed_at = coalesce(processed_at, v_sub.paid_at, now())
    where id = p_payment_id
      and status = 'pending';

    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'payment_id', p_payment_id,
      'subscription_id', v_sub.id,
      'current_period_end', v_sub.current_period_end,
      'status', 'confirmed'
    );
  end if;

  -- Payment confirmation grants one billing period. Extend from the later of
  -- now/current end so an early renewal does not shorten an existing term.
  v_base := greatest(coalesce(v_sub.current_period_end, now()), now());
  v_end := v_base + interval '1 month';
  v_paid_at := coalesce(v_sub.paid_at, now());

  update public.subscriptions
  set status = 'active',
      current_period_end = v_end,
      payment_id = p_payment_id,
      payment_status = 'paid',
      paid_at = v_paid_at,
      plan_id = v_plan.id
  where id = v_sub.id
  returning * into v_sub;

  update public.payments
  set status = 'confirmed',
      processed_at = coalesce(processed_at, v_paid_at)
  where id = p_payment_id
    and status = 'pending';

  if not found then
    -- Defensive guard for future trigger/RPC changes.
    return jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'payment_id', p_payment_id,
      'subscription_id', v_sub.id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_processed', false,
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

-- Keep the legacy manual-payment RPC on the same canonical plans table and
-- entitlement path. It is service-role only and therefore cannot be called
-- directly by an authenticated browser session.
create or replace function public.admin_confirm_manual_payment(p_payment_id uuid)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_sub public.subscriptions%rowtype;
  v_plan public.plans%rowtype;
  v_base timestamptz;
  v_paid_at timestamptz;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'payment_not_found'; end if;
  if v_payment.status <> 'pending' then
    select * into v_sub from public.subscriptions
    where manager_id = v_payment.manager_id and venue_id is null
    order by created_at desc limit 1;
    if v_sub.id is null then raise exception 'payment_already_processed:%', v_payment.status; end if;
    return v_sub;
  end if;

  select * into v_plan from public.plans
  where id = v_payment.plan_id and is_active = true;
  if not found then raise exception 'plan_not_found_or_inactive'; end if;

  select * into v_sub
  from public.subscriptions
  where manager_id = v_payment.manager_id and venue_id is null
  order by created_at desc limit 1
  for update;

  if v_sub.id is not null
     and v_sub.payment_id = p_payment_id
     and v_sub.payment_status = 'paid'
     and v_sub.paid_at is not null then
    return v_sub;
  end if;

  select * into v_sub
  from public.admin_set_manager_plan(v_payment.manager_id, v_plan.id::text);

  select * into v_sub from public.subscriptions where id = v_sub.id for update;
  if v_sub.payment_id = p_payment_id and v_sub.payment_status = 'paid' and v_sub.paid_at is not null then
    return v_sub;
  end if;

  v_base := greatest(coalesce(v_sub.current_period_end, now()), now());
  v_paid_at := coalesce(v_sub.paid_at, now());
  update public.subscriptions
  set status = 'active',
      current_period_end = v_base + interval '1 month',
      payment_id = p_payment_id,
      payment_status = 'paid',
      paid_at = v_paid_at,
      plan_id = v_plan.id
  where id = v_sub.id
  returning * into v_sub;

  update public.payments
  set status = 'confirmed', processed_at = coalesce(processed_at, v_paid_at)
  where id = p_payment_id and status = 'pending';

  return v_sub;
end;
$$;

revoke execute on function public.admin_confirm_manual_payment(uuid) from public, anon, authenticated;
grant execute on function public.admin_confirm_manual_payment(uuid) to service_role;

commit;
