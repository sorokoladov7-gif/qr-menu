-- QR Menu — final legacy cleanup / expiry synchronization.
-- Complements 20260902_p0_p1_saas_consolidation.sql and keeps the canonical
-- manager-owned subscription model consistent with runtime fixes.

CREATE OR REPLACE FUNCTION public.guard_venue_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF coalesce(current_setting('qr.internal_sync', true), 'false')='true' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  IF NOT public.is_manager_of(NEW.id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url OR NEW.brand_color IS DISTINCT FROM OLD.brand_color THEN
    IF NOT public.manager_has_permission(NEW.id,'edit_branding') THEN RAISE EXCEPTION 'branding_permission_required'; END IF;
  END IF;
  IF NEW.design_settings IS DISTINCT FROM OLD.design_settings THEN
    IF NOT public.manager_has_permission(NEW.id,'edit_design') THEN RAISE EXCEPTION 'design_permission_required'; END IF;
  END IF;
  IF NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.delivery_base_price IS DISTINCT FROM OLD.delivery_base_price
     OR NEW.delivery_per_km IS DISTINCT FROM OLD.delivery_per_km
     OR NEW.delivery_max_km IS DISTINCT FROM OLD.delivery_max_km
     OR NEW.delivery_rate_per_km IS DISTINCT FROM OLD.delivery_rate_per_km
     OR NEW.delivery_min_order_free IS DISTINCT FROM OLD.delivery_min_order_free
     OR NEW.delivery_min_order IS DISTINCT FROM OLD.delivery_min_order
     OR NEW.delivery_base_fee IS DISTINCT FROM OLD.delivery_base_fee
     OR NEW.latitude IS DISTINCT FROM OLD.latitude
     OR NEW.longitude IS DISTINCT FROM OLD.longitude
     OR NEW.lat IS DISTINCT FROM OLD.lat
     OR NEW.lng IS DISTINCT FROM OLD.lng THEN
    IF NOT public.manager_has_permission(NEW.id,'edit_delivery') THEN RAISE EXCEPTION 'delivery_permission_required'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_manager_subscription_to_venues()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  IF NEW.manager_id IS NULL OR NEW.venue_id IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM set_config('qr.internal_sync','true',true);
  UPDATE public.venues v
  SET plan=NEW.plan_id,
      subscription_end=NEW.current_period_end,
      status=CASE WHEN NEW.status IN('active','trialing') AND NEW.current_period_end>=now() THEN 'active' ELSE 'paused' END
  WHERE v.id IN (SELECT mv.venue_id FROM public.manager_venues mv WHERE mv.manager_id=NEW.manager_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  PERFORM set_config('qr.internal_sync','true',true);
  UPDATE public.subscriptions
  SET status='expired'
  WHERE current_period_end<now() AND status IN('active','trialing');
  UPDATE public.venues v
  SET status=CASE WHEN EXISTS(
    SELECT 1 FROM public.manager_venues mv
    JOIN public.subscriptions s ON s.manager_id=mv.manager_id
    WHERE mv.venue_id=v.id AND s.venue_id IS NULL
      AND s.status IN('active','trialing') AND s.current_period_end>=now()
  ) THEN 'active' ELSE 'paused' END
  WHERE EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=v.id);
  UPDATE public.venues v
  SET status='paused'
  WHERE v.status='active'
    AND NOT EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=v.id)
    AND EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.venue_id=v.id AND s.status IN('active','trialing') AND s.current_period_end<now());
END;
$$;

CREATE OR REPLACE FUNCTION public.manager_create_staff(p_venue_id uuid, p_type text, p_name text, p_phone text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
declare
  new_id uuid;
  hashed text;
  v_manager_id uuid;
  v_sub public.subscriptions;
  v_plan public.plans;
  v_count integer;
  v_limit integer;
begin
  if not public.manager_can_manage_venue(p_venue_id) then raise exception 'not_authorized'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'pin_must_be_4_digits'; end if;
  if p_type not in ('cook','courier','waiter') then raise exception 'invalid_staff_type'; end if;

  select manager_id into v_manager_id
  from public.manager_venues
  where venue_id=p_venue_id and manager_id=auth.uid()
  limit 1;

  if v_manager_id is null and exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    select manager_id into v_manager_id from public.manager_venues where venue_id=p_venue_id limit 1;
  end if;
  if v_manager_id is null then raise exception 'manager_required'; end if;

  select * into v_sub
  from public.subscriptions
  where manager_id=v_manager_id and venue_id is null
    and status in ('trialing','active') and current_period_end>=now()
  order by case when status='active' then 0 else 1 end, created_at desc
  limit 1;
  if v_sub.id is null then raise exception 'subscription_required'; end if;

  select * into v_plan from public.plans where id=v_sub.plan_id and is_active=true;
  if v_plan.id is null then raise exception 'plan_not_found'; end if;

  if p_type='cook' then
    select count(*) into v_count from public.cooks c
    join public.manager_venues mv on mv.venue_id=c.venue_id
    where mv.manager_id=v_manager_id and coalesce(c.is_active,true)=true;
    v_limit:=v_plan.max_cooks;
  elsif p_type='courier' then
    select count(*) into v_count from public.couriers c
    join public.manager_venues mv on mv.venue_id=c.venue_id
    where mv.manager_id=v_manager_id and coalesce(c.is_active,true)=true;
    v_limit:=v_plan.max_couriers;
  else
    select count(*) into v_count from public.waiters w
    join public.manager_venues mv on mv.venue_id=w.venue_id
    where mv.manager_id=v_manager_id and coalesce(w.is_active,true)=true;
    v_limit:=v_plan.max_waiters;
  end if;

  if v_count>=coalesce(v_limit,0) then raise exception 'staff_limit_reached:%:%', p_type, v_limit; end if;

  hashed:=extensions.crypt(p_pin,extensions.gen_salt('bf',6));
  new_id:=gen_random_uuid();
  if p_type='cook' then
    insert into public.cooks(id,venue_id,name,phone,pin,is_active) values(new_id,p_venue_id,p_name,p_phone,hashed,true);
  elsif p_type='courier' then
    insert into public.couriers(id,venue_id,name,phone,pin,is_active) values(new_id,p_venue_id,p_name,p_phone,hashed,true);
  else
    insert into public.waiters(id,venue_id,name,phone,pin,is_active) values(new_id,p_venue_id,p_name,p_phone,hashed,true);
  end if;
  return jsonb_build_object('ok',true,'id',new_id,'pin',p_pin,'manager_staff_count',v_count+1,'manager_staff_limit',v_limit);
end;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_manager_subscription_owner() FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_profile_create() FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_manager_subscription_to_venues() FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_venue_link() FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_venue_feature_defaults() FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_venue_for_manager_v2(uuid,text,text,text,timestamptz,jsonb,uuid) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_venue_from_template(text,text,text,text,timestamptz) FROM public,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_venue_for_manager(text,text,text,timestamptz,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_import_venue(text,text,text,timestamptz,text,text,text,text,text,jsonb,jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.manager_create_staff(uuid,text,text,text,text) TO authenticated;
