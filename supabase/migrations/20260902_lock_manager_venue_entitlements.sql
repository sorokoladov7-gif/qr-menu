-- QR Menu SaaS: subscription/entitlement projections on venues are server-managed.
-- Managers may edit venue settings, but cannot change billing state directly.

create or replace function public.guard_venue_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('qr.internal_sync', true), 'false') = 'true' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if not public.is_manager_of(new.id) then
    raise exception 'not_authorized';
  end if;

  if new.plan is distinct from old.plan
     or new.subscription_end is distinct from old.subscription_end
     or new.status is distinct from old.status then
    raise exception 'subscription_fields_are_server_managed';
  end if;

  if new.logo_url is distinct from old.logo_url
     or new.brand_color is distinct from old.brand_color then
    if not public.manager_has_permission(new.id,'edit_branding') then
      raise exception 'branding_permission_required';
    end if;
  end if;

  if new.design_settings is distinct from old.design_settings then
    if not public.manager_has_permission(new.id,'edit_design') then
      raise exception 'design_permission_required';
    end if;
  end if;

  if new.delivery_fee is distinct from old.delivery_fee
     or new.delivery_base_price is distinct from old.delivery_base_price
     or new.delivery_per_km is distinct from old.delivery_per_km
     or new.delivery_max_km is distinct from old.delivery_max_km
     or new.delivery_rate_per_km is distinct from old.delivery_rate_per_km
     or new.delivery_min_order_free is distinct from old.delivery_min_order_free
     or new.delivery_min_order is distinct from old.delivery_min_order
     or new.delivery_base_fee is distinct from old.delivery_base_fee
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude
     or new.lat is distinct from old.lat
     or new.lng is distinct from old.lng then
    if not public.manager_has_permission(new.id,'edit_delivery') then
      raise exception 'delivery_permission_required';
    end if;
  end if;

  return new;
end;
$$;
