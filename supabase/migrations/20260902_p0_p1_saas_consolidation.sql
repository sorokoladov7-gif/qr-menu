-- QR Menu — P0/P1 SaaS consolidation.
-- Canonical model:
--   manager -> one manager-owned subscription -> many linked venues.
--   venues.plan/subscription_end/status are projections of the canonical subscription.
--   venue creation and optional initial products are one atomic operation.

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.role IS NULL THEN NEW.role:='manager';
    ELSIF NEW.role='admin' AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'role_change_forbidden' USING errcode='42501';
    ELSIF NEW.role NOT IN ('manager','admin') THEN
      RAISE EXCEPTION 'invalid_profile_role' USING errcode='22023';
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'role_change_forbidden' USING errcode='42501';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_profile_role_change ON public.profiles;
CREATE TRIGGER trg_guard_profile_role_change
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

UPDATE public.plans SET price=3499,max_venues=2,max_cooks=1,max_couriers=1,max_waiters=1,max_products=50 WHERE id='start';
UPDATE public.plans SET price=5499,max_venues=3,max_cooks=2,max_couriers=2,max_waiters=2,max_products=100 WHERE id='business';
UPDATE public.plans SET price=8499,max_venues=6,max_cooks=4,max_couriers=4,max_waiters=4,max_products=200 WHERE id='premium';
UPDATE public.plans SET price=11498,max_venues=10,max_cooks=6,max_couriers=6,max_waiters=6,max_products=300 WHERE id='network';

DROP FUNCTION IF EXISTS public.create_venue_for_manager(text,text,text,timestamptz);
CREATE FUNCTION public.create_venue_for_manager(
  p_name text,
  p_slug text,
  p_plan text DEFAULT 'start',
  p_subscription_end timestamptz DEFAULT NULL,
  p_products jsonb DEFAULT NULL
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_role text;
  v_existing_count integer:=0;
  v_plan text;
  v_end timestamptz;
  v_max_venues integer;
  v_max_products integer;
  v_products jsonb:=CASE WHEN jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' THEN coalesce(p_products,'[]'::jsonb) ELSE '[]'::jsonb END;
  v_product_count integer;
  v_venue public.venues;
  v_subscription public.subscriptions;
  v_item jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Пользователь не авторизован'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id=v_user_id;
  IF v_role IS NULL OR v_role NOT IN('manager','admin') THEN RAISE EXCEPTION 'Недостаточно прав для создания заведения'; END IF;
  IF nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Название заведения обязательно'; END IF;
  IF nullif(trim(p_slug),'') IS NULL THEN RAISE EXCEPTION 'Код заведения обязателен'; END IF;
  IF EXISTS(SELECT 1 FROM public.venues WHERE lower(slug)=lower(trim(p_slug))) THEN RAISE EXCEPTION 'Заведение с таким кодом уже существует'; END IF;

  IF v_role='manager' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text,0));
    SELECT s.* INTO v_subscription
    FROM public.subscriptions s
    WHERE s.manager_id=v_user_id AND s.venue_id IS NULL
      AND s.status IN('trialing','active') AND s.current_period_end>=now()
    ORDER BY CASE WHEN s.status='active' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 1;

    IF v_subscription.id IS NULL THEN
      SELECT v.plan,v.subscription_end INTO v_plan,v_end
      FROM public.venues v JOIN public.manager_venues mv ON mv.venue_id=v.id
      WHERE mv.manager_id=v_user_id AND v.subscription_end>=now()
      ORDER BY v.created_at ASC LIMIT 1;
      IF v_plan IS NOT NULL THEN
        INSERT INTO public.subscriptions(manager_id,venue_id,plan_id,status,current_period_end)
        VALUES(v_user_id,NULL,v_plan,'trialing',v_end) RETURNING * INTO v_subscription;
      END IF;
    END IF;

    IF v_subscription.id IS NULL THEN
      v_plan:=coalesce(nullif(trim(p_plan),''),'start');
      v_end:=coalesce(p_subscription_end,now()+interval '10 days');
      INSERT INTO public.subscriptions(manager_id,venue_id,plan_id,status,current_period_end)
      VALUES(v_user_id,NULL,v_plan,'trialing',v_end) RETURNING * INTO v_subscription;
    END IF;

    v_plan:=v_subscription.plan_id;
    v_end:=v_subscription.current_period_end;
    SELECT count(*) INTO v_existing_count FROM public.manager_venues WHERE manager_id=v_user_id;
    SELECT max_venues,max_products INTO v_max_venues,v_max_products FROM public.plans WHERE id=v_plan AND is_active=true;
    IF coalesce(v_max_venues,0)<=0 THEN RAISE EXCEPTION 'manager_plan_invalid'; END IF;
    IF v_existing_count>=v_max_venues THEN RAISE EXCEPTION 'Достигнут лимит заведений тарифа: %',v_max_venues; END IF;
  ELSE
    v_plan:=coalesce(nullif(trim(p_plan),''),'start');
    v_end:=p_subscription_end;
    SELECT max_products INTO v_max_products FROM public.plans WHERE id=v_plan AND is_active=true;
    IF coalesce(v_max_products,0)<=0 THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  END IF;

  v_product_count:=jsonb_array_length(v_products);
  IF v_product_count>coalesce(v_max_products,0) THEN RAISE EXCEPTION 'product_limit_reached'; END IF;

  INSERT INTO public.venues(name,slug,status,plan,subscription_end)
  VALUES(trim(p_name),lower(trim(p_slug)),'active',v_plan,v_end)
  RETURNING * INTO v_venue;

  INSERT INTO public.manager_venues(manager_id,venue_id)
  VALUES(v_user_id,v_venue.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.manager_venue_permissions(manager_id,venue_id,can_edit_menu,can_edit_prices)
  VALUES(v_user_id,v_venue.id,true,true) ON CONFLICT DO NOTHING;

  IF v_role='admin' THEN
    INSERT INTO public.subscriptions(venue_id,manager_id,plan_id,status,current_period_end)
    VALUES(v_venue.id,v_user_id,v_plan,'active',v_end);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_products) LOOP
    IF coalesce(trim(v_item->>'name'),'')='' THEN CONTINUE; END IF;
    INSERT INTO public.products(venue_id,name,description,price,category,image_url,is_available,applies_to)
    VALUES(v_venue.id,trim(v_item->>'name'),nullif(v_item->>'description',''),greatest(coalesce((v_item->>'price')::numeric,0),0),coalesce(nullif(trim(v_item->>'category'),''),'main'),nullif(v_item->>'image_url',''),coalesce((v_item->>'is_available')::boolean,true),coalesce(nullif(v_item->>'applies_to',''),'all'));
  END LOOP;

  RETURN v_venue;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_venue_for_manager(text,text,text,timestamptz,jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_venue_for_manager(text,text,text,timestamptz,jsonb) FROM anon,public;

CREATE OR REPLACE FUNCTION public.manager_import_venue(p_name text,p_slug text,p_plan text,p_subscription_end timestamptz,p_address text DEFAULT NULL,p_phone text DEFAULT NULL,p_website_url text DEFAULT NULL,p_description text DEFAULT NULL,p_logo_url text DEFAULT NULL,p_opening_hours jsonb DEFAULT NULL,p_products jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_uid uuid:=auth.uid(); v_sub public.subscriptions; v_venue public.venues; v_products jsonb:=CASE WHEN jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' THEN coalesce(p_products,'[]'::jsonb) ELSE '[]'::jsonb END; v_count integer; v_plan public.plans;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'manager_auth_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid AND role='manager') THEN RAISE EXCEPTION 'manager_role_required'; END IF;
  SELECT s.* INTO v_sub FROM public.subscriptions s WHERE s.manager_id=v_uid AND s.venue_id IS NULL AND s.status IN('trialing','active') AND s.current_period_end>=now() ORDER BY CASE WHEN s.status='active' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 1;
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
  v_venue:=public.create_venue_for_manager(trim(p_name),lower(trim(p_slug)),v_plan.id,coalesce(v_sub.current_period_end,p_subscription_end,now()+interval '10 days'),v_products);
  UPDATE public.venues SET address=nullif(trim(p_address),''),phone=nullif(trim(p_phone),''),website_url=nullif(trim(p_website_url),''),description=nullif(trim(p_description),''),logo_url=nullif(trim(p_logo_url),''),opening_hours=p_opening_hours WHERE id=v_venue.id;
  RETURN jsonb_build_object('venue_id',v_venue.id,'name',v_venue.name,'products_count',jsonb_array_length(v_products),'manager_id',v_uid,'plan_id',v_plan.id,'subscription_id',coalesce(v_sub.id,(SELECT s.id FROM public.subscriptions s WHERE s.manager_id=v_uid AND s.venue_id IS NULL ORDER BY s.created_at DESC LIMIT 1)));
END; $$;
REVOKE EXECUTE ON FUNCTION public.manager_import_venue(text,text,text,timestamptz,text,text,text,text,text,jsonb,jsonb) FROM anon,public;
GRANT EXECUTE ON FUNCTION public.manager_import_venue(text,text,text,timestamptz,text,text,text,text,text,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_manager_subscription_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.manager_id IS NOT NULL THEN NEW.venue_id:=NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_normalize_manager_subscription_owner ON public.subscriptions;
CREATE TRIGGER trg_normalize_manager_subscription_owner BEFORE INSERT OR UPDATE OF manager_id,venue_id ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.normalize_manager_subscription_owner();

CREATE OR REPLACE FUNCTION public.ensure_manager_subscription_on_profile_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_venue public.venues; v_plan text; v_end timestamptz;
BEGIN
  IF NEW.role<>'manager' THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.manager_id=NEW.id) THEN RETURN NEW; END IF;
  SELECT v.plan,v.subscription_end INTO v_plan,v_end FROM public.venues v JOIN public.manager_venues mv ON mv.venue_id=v.id WHERE mv.manager_id=NEW.id ORDER BY v.created_at ASC LIMIT 1;
  INSERT INTO public.subscriptions(manager_id,venue_id,plan_id,status,current_period_end) VALUES(NEW.id,NULL,coalesce(v_plan,'start'),'trialing',coalesce(v_end,now()+interval '10 days'));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_ensure_manager_subscription_on_profile_create ON public.profiles;
CREATE TRIGGER trg_ensure_manager_subscription_on_profile_create AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.ensure_manager_subscription_on_profile_create();

CREATE OR REPLACE FUNCTION public.sync_manager_subscription_to_venues()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.manager_id IS NULL OR NEW.venue_id IS NOT NULL THEN RETURN NEW; END IF;
  UPDATE public.venues v SET plan=NEW.plan_id,subscription_end=NEW.current_period_end,status=CASE WHEN NEW.status IN('active','trialing') AND NEW.current_period_end>=now() THEN 'active' ELSE 'paused' END WHERE v.id IN(SELECT mv.venue_id FROM public.manager_venues mv WHERE mv.manager_id=NEW.manager_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.subscriptions SET status='expired' WHERE current_period_end<now() AND status IN('active','trialing');
  UPDATE public.venues v SET status=CASE WHEN EXISTS(
    SELECT 1 FROM public.manager_venues mv JOIN public.subscriptions s ON s.manager_id=mv.manager_id
    WHERE mv.venue_id=v.id AND s.venue_id IS NULL AND s.status IN('active','trialing') AND s.current_period_end>=now()
  ) THEN 'active' ELSE 'paused' END WHERE EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=v.id);
  UPDATE public.venues v SET status='paused' WHERE v.status='active' AND NOT EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=v.id) AND EXISTS(SELECT 1 FROM public.subscriptions s WHERE s.venue_id=v.id AND s.status IN('active','trialing') AND s.current_period_end<now());
END; $$;

ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_product_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingredient_aliases_manager_select ON public.ingredient_aliases;
DROP POLICY IF EXISTS ingredient_aliases_manager_write ON public.ingredient_aliases;
CREATE POLICY ingredient_aliases_manager_select ON public.ingredient_aliases FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=ingredient_aliases.venue_id AND mv.manager_id=auth.uid()));
CREATE POLICY ingredient_aliases_manager_write ON public.ingredient_aliases FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=ingredient_aliases.venue_id AND mv.manager_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=ingredient_aliases.venue_id AND mv.manager_id=auth.uid()));
DROP POLICY IF EXISTS recipe_product_aliases_manager_select ON public.recipe_product_aliases;
DROP POLICY IF EXISTS recipe_product_aliases_manager_write ON public.recipe_product_aliases;
CREATE POLICY recipe_product_aliases_manager_select ON public.recipe_product_aliases FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=recipe_product_aliases.venue_id AND mv.manager_id=auth.uid()));
CREATE POLICY recipe_product_aliases_manager_write ON public.recipe_product_aliases FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=recipe_product_aliases.venue_id AND mv.manager_id=auth.uid())) WITH CHECK (EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS(SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=recipe_product_aliases.venue_id AND mv.manager_id=auth.uid()));

REVOKE ALL ON FUNCTION public.auto_generate_product_recipe(uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.trg_auto_generate_product_recipe() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.normalize_global_recipe_photo_url() FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.recipe_alias_seed(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.recipe_sync_venue(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.recipe_sync_venue_internal(uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.manager_recipe_auto_sync(uuid,uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.manager_recipe_completeness_audit(uuid,uuid) FROM public,anon;
REVOKE ALL ON FUNCTION public.guard_profile_role_change() FROM public,anon,authenticated;

ALTER FUNCTION public.site_analyzer_learning_updated_at() SET search_path=public;
ALTER FUNCTION public.recipe_name_score(text,text,text[]) SET search_path=public;
ALTER FUNCTION public.recipe_name_normalize(text) SET search_path=public;
ALTER FUNCTION public.recipe_catalog_match_score(text,text,uuid) SET search_path=public;
ALTER FUNCTION public.recipe_norm(text) SET search_path=public;
ALTER FUNCTION public.recipe_stem(text) SET search_path=public;
ALTER FUNCTION public.recipe_local_unit(text) SET search_path=public;
ALTER FUNCTION public.normalize_recipe_term(text) SET search_path=public;
ALTER FUNCTION public.public_venue_has_waiters(uuid) SET search_path=public;
ALTER FUNCTION public.resolve_waiter_call(uuid,uuid) SET search_path=public;
ALTER FUNCTION public.resolve_cook_call(uuid,uuid) SET search_path=public;
ALTER FUNCTION public.create_waiter_call(uuid,text) SET search_path=public;
ALTER FUNCTION public.create_cook_call(uuid,text) SET search_path=public;