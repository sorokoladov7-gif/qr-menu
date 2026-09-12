-- Preserve manager_import_venue site-import behavior when logo_url is supplied.
-- create_venue_for_manager intentionally grants only menu/price permissions.
-- The import RPC is SECURITY DEFINER and owns the atomic import, so the
-- branding permission needed only for the internal logo projection is enabled
-- for the newly-created venue and restored before the RPC returns.

CREATE OR REPLACE FUNCTION public.manager_import_venue(
  p_name text,
  p_slug text,
  p_plan text,
  p_subscription_end timestamptz,
  p_address text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_opening_hours jsonb DEFAULT NULL,
  p_products jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid:=auth.uid();
  v_sub public.subscriptions;
  v_venue public.venues;
  v_products jsonb:=CASE WHEN jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' THEN coalesce(p_products,'[]'::jsonb) ELSE '[]'::jsonb END;
  v_count integer;
  v_plan public.plans;
  v_had_branding_permission boolean:=false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'manager_auth_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid AND role='manager') THEN RAISE EXCEPTION 'manager_role_required'; END IF;

  SELECT s.* INTO v_sub
  FROM public.subscriptions s
  WHERE s.manager_id=v_uid
    AND s.venue_id IS NULL
    AND s.status IN('trialing','active')
    AND s.current_period_end>=now()
  ORDER BY CASE WHEN s.status='active' THEN 0 ELSE 1 END,s.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.plans WHERE id=v_sub.plan_id AND is_active=true LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'subscription_plan_not_found'; END IF;
  ELSE
    SELECT * INTO v_plan FROM public.plans WHERE id=coalesce(nullif(trim(p_plan),''),'start') AND is_active=true LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
    SELECT count(*) INTO v_count FROM public.manager_venues WHERE manager_id=v_uid;
    IF v_count>=coalesce(v_plan.max_venues,0) THEN RAISE EXCEPTION 'venue_limit_reached'; END IF;
    IF jsonb_array_length(v_products)>coalesce(v_plan.max_products,0) THEN RAISE EXCEPTION 'product_limit_reached'; END IF;
  END IF;

  v_venue:=public.create_venue_for_manager(
    trim(p_name),
    lower(trim(p_slug)),
    v_plan.id,
    coalesce(v_sub.current_period_end,p_subscription_end,now()+interval '10 days'),
    v_products
  );

  SELECT coalesce(can_edit_branding,false)
    INTO v_had_branding_permission
  FROM public.manager_venue_permissions
  WHERE manager_id=v_uid AND venue_id=v_venue.id;

  -- The trigger on venues protects ordinary manager writes. This temporary
  -- permission is scoped to this newly-created venue and this transaction.
  IF p_logo_url IS NOT NULL AND nullif(trim(p_logo_url),'') IS NOT NULL THEN
    INSERT INTO public.manager_venue_permissions(
      manager_id,venue_id,can_edit_branding
    ) VALUES(v_uid,v_venue.id,true)
    ON CONFLICT(manager_id,venue_id) DO UPDATE
      SET can_edit_branding=true;
  END IF;

  UPDATE public.venues
  SET address=nullif(trim(p_address),''),
      phone=nullif(trim(p_phone),''),
      website_url=nullif(trim(p_website_url),''),
      description=nullif(trim(p_description),''),
      logo_url=nullif(trim(p_logo_url),''),
      opening_hours=p_opening_hours
  WHERE id=v_venue.id;

  IF p_logo_url IS NOT NULL AND nullif(trim(p_logo_url),'') IS NOT NULL THEN
    UPDATE public.manager_venue_permissions
    SET can_edit_branding=v_had_branding_permission
    WHERE manager_id=v_uid AND venue_id=v_venue.id;
  END IF;

  RETURN jsonb_build_object(
    'venue_id',v_venue.id,
    'name',v_venue.name,
    'products_count',jsonb_array_length(v_products),
    'manager_id',v_uid,
    'plan_id',v_plan.id,
    'subscription_id',coalesce(v_sub.id,(SELECT s.id FROM public.subscriptions s WHERE s.manager_id=v_uid AND s.venue_id IS NULL ORDER BY s.created_at DESC LIMIT 1))
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.manager_import_venue(text,text,text,timestamptz,text,text,text,text,text,jsonb,jsonb) FROM anon,public;
GRANT EXECUTE ON FUNCTION public.manager_import_venue(text,text,text,timestamptz,text,text,text,text,text,jsonb,jsonb) TO authenticated;
