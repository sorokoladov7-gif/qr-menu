-- QR Menu SaaS: enforce manager-wide product limits at the database boundary.
-- Prevents managers from bypassing max_products by adding products after venue creation.

begin;

create or replace function public.guard_product_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager_id uuid;
  v_sub public.subscriptions;
  v_plan public.plans;
  v_count integer;
begin
  if public.is_admin() then
    return new;
  end if;

  if not public.is_manager_of(new.venue_id) then
    raise exception 'not_authorized';
  end if;

  if not public.manager_has_permission(new.venue_id, 'edit_menu') then
    raise exception 'menu_permission_required';
  end if;

  if tg_op = 'INSERT' then
    select mv.manager_id
      into v_manager_id
    from public.manager_venues mv
    where mv.venue_id = new.venue_id
      and mv.manager_id = auth.uid()
    limit 1;

    if v_manager_id is null then
      raise exception 'manager_required';
    end if;

    select * into v_sub
    from public.subscriptions
    where manager_id = v_manager_id
      and venue_id is null
      and status in ('trialing','active')
      and current_period_end >= now()
    order by case when status = 'active' then 0 else 1 end, created_at desc
    limit 1;

    if v_sub.id is null then
      raise exception 'subscription_required';
    end if;

    select * into v_plan
    from public.plans
    where id = v_sub.plan_id
      and is_active = true;

    if v_plan.id is null then
      raise exception 'plan_not_found';
    end if;

    select count(*) into v_count
    from public.products p
    join public.manager_venues mv on mv.venue_id = p.venue_id
    where mv.manager_id = v_manager_id;

    if v_count >= coalesce(v_plan.max_products, 0) then
      raise exception 'product_limit_reached:%:%', v_count, v_plan.max_products;
    end if;

    if new.price is distinct from 0 and not public.manager_has_permission(new.venue_id, 'edit_prices') then
      raise exception 'price_permission_required';
    end if;
  else
    if (new.name, new.description, new.category, new.image_url, new.is_available, new.applies_to) is distinct from
       (old.name, old.description, old.category, old.image_url, old.is_available, old.applies_to)
       and not public.manager_has_permission(new.venue_id, 'edit_menu') then
      raise exception 'menu_permission_required';
    end if;

    if new.price is distinct from old.price and not public.manager_has_permission(new.venue_id, 'edit_prices') then
      raise exception 'price_permission_required';
    end if;
  end if;

  return new;
end;
$$;

commit;
