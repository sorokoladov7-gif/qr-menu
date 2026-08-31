-- Fix manager multi-venue creation and settings saving.
-- Existing manager UI calls create_venue_for_manager(...). The first venue may
-- be created with an explicit plan, while additional venues must inherit the
-- manager subscription plan and its trial/paid end date.

CREATE OR REPLACE FUNCTION public.create_venue_for_manager(
  p_name text,
  p_slug text,
  p_plan text DEFAULT 'start'::text,
  p_subscription_end timestamptz DEFAULT NULL::timestamptz
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_existing_count integer := 0;
  v_plan text;
  v_end timestamptz;
  v_max_venues integer;
  v_venue public.venues;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Пользователь не авторизован';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role IS NULL OR v_role NOT IN ('manager','admin') THEN
    RAISE EXCEPTION 'Недостаточно прав для создания заведения';
  END IF;

  IF nullif(trim(p_name),'') IS NULL THEN
    RAISE EXCEPTION 'Название заведения обязательно';
  END IF;
  IF nullif(trim(p_slug),'') IS NULL THEN
    RAISE EXCEPTION 'Код заведения обязателен';
  END IF;
  IF EXISTS (SELECT 1 FROM public.venues WHERE lower(slug)=lower(trim(p_slug))) THEN
    RAISE EXCEPTION 'Заведение с таким кодом уже существует';
  END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.manager_venues
  WHERE manager_id=v_user_id;

  -- Additional venues inherit the manager-level subscription.
  IF v_role='manager' AND v_existing_count > 0 THEN
    SELECT s.plan_id, s.current_period_end
      INTO v_plan, v_end
    FROM public.subscriptions s
    WHERE s.manager_id=v_user_id
      AND s.venue_id IS NULL
      AND s.status IN ('trialing','active')
      AND s.current_period_end >= now()
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan IS NULL THEN
      SELECT v.plan INTO v_plan
      FROM public.venues v
      JOIN public.manager_venues mv ON mv.venue_id=v.id
      WHERE mv.manager_id=v_user_id
      ORDER BY v.created_at ASC
      LIMIT 1;
    END IF;

    v_plan := coalesce(v_plan, nullif(trim(p_plan), ''), 'start');
    v_end := coalesce(v_end, p_subscription_end);
  ELSE
    v_plan := coalesce(nullif(trim(p_plan), ''), 'start');
    v_end := p_subscription_end;
  END IF;

  SELECT max_venues INTO v_max_venues
  FROM public.plans
  WHERE id=v_plan;

  IF v_role='manager' AND v_max_venues IS NOT NULL AND v_existing_count >= v_max_venues THEN
    RAISE EXCEPTION 'Достигнут лимит заведений тарифа: %', v_max_venues;
  END IF;

  INSERT INTO public.venues(name,slug,status,plan,subscription_end)
  VALUES(trim(p_name),lower(trim(p_slug)),'active',v_plan,v_end)
  RETURNING * INTO v_venue;

  INSERT INTO public.manager_venues(manager_id,venue_id)
  VALUES(v_user_id,v_venue.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.manager_venue_permissions(manager_id,venue_id,can_edit_menu)
  VALUES(v_user_id,v_venue.id,true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions(venue_id,plan_id,status,current_period_end)
  VALUES(v_venue.id,v_plan,'trialing',v_end);

  RETURN v_venue;
END;
$$;

-- Managers must be able to save the settings of venues they manage.
-- Keep the permission boundary at the venue ownership/link level; the UI's
-- individual edit permissions continue to control feature-specific actions.
DROP POLICY IF EXISTS manager_update_own_venues ON public.venues;
CREATE POLICY manager_update_own_venues
ON public.venues
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.manager_venues mv
    WHERE mv.venue_id=venues.id
      AND mv.manager_id=auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role='admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.manager_venues mv
    WHERE mv.venue_id=venues.id
      AND mv.manager_id=auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=auth.uid() AND p.role='admin'
  )
);

GRANT EXECUTE ON FUNCTION public.create_venue_for_manager(text,text,text,timestamptz) TO authenticated;
