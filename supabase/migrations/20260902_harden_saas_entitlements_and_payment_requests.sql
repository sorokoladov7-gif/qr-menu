begin;

-- Exactly one canonical manager-owned subscription.
create unique index if not exists subscriptions_one_manager_owned_uq
  on public.subscriptions(manager_id)
  where manager_id is not null and venue_id is null;

-- Manager payment rows are requests only; never accept arbitrary billing values.
drop policy if exists "manager insert payments" on public.payments;
create policy "manager insert pending payment request"
  on public.payments
  for insert to authenticated
  with check (manager_id = auth.uid() and status = 'pending');

create or replace function public.guard_manager_payment_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_plan public.plans;
begin
  if new.manager_id is null then raise exception 'manager_required'; end if;
  if not exists(select 1 from public.profiles p where p.id=new.manager_id and p.role in ('manager','admin')) then raise exception 'invalid_manager'; end if;
  if new.venue_id is not null and not exists(select 1 from public.manager_venues mv where mv.manager_id=new.manager_id and mv.venue_id=new.venue_id) then raise exception 'venue_access_denied'; end if;
  select * into v_plan from public.plans where id=new.plan_id and is_active=true;
  if v_plan.id is null then raise exception 'plan_not_found'; end if;
  new.amount:=v_plan.price;
  new.status:='pending';
  return new;
end;
$$;

drop trigger if exists trg_guard_manager_payment_request on public.payments;
create trigger trg_guard_manager_payment_request before insert on public.payments for each row execute function public.guard_manager_payment_request();

-- Product-wide rule: trial is exactly 10 days.
update public.subscriptions
set current_period_end=created_at+interval '10 days'
where status='trialing' and current_period_end>created_at+interval '10 days';

commit;
