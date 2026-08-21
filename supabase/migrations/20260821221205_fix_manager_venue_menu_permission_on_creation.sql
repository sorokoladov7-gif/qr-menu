-- Ensure every existing manager/venue link has an explicit permission row.
INSERT INTO public.manager_venue_permissions (manager_id, venue_id, can_edit_menu)
SELECT mv.manager_id, mv.venue_id, true
FROM public.manager_venues mv
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manager_venue_permissions p
  WHERE p.manager_id = mv.manager_id
    AND p.venue_id = mv.venue_id
);

-- The manager UI currently calls the 4-argument overload. Keep that API intact,
-- but create the permission row at the same time as the manager/venue link.
CREATE OR REPLACE FUNCTION public.create_venue_for_manager(
  p_name text,
  p_slug text,
  p_plan text DEFAULT 'start'::text,
  p_subscription_end timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_role text;
  v_venue public.venues;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Пользователь не авторизован';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Профиль пользователя не найден';
  END IF;

  IF v_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'Недостаточно прав для создания заведения';
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Название заведения обязательно';
  END IF;

  IF NULLIF(trim(p_slug), '') IS NULL THEN
    RAISE EXCEPTION 'Код заведения обязателен';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.venues
    WHERE slug = lower(trim(p_slug))
  ) THEN
    RAISE EXCEPTION 'Заведение с таким кодом уже существует';
  END IF;

  INSERT INTO public.venues (
    name,
    slug,
    status,
    plan,
    subscription_end
  )
  VALUES (
    trim(p_name),
    lower(trim(p_slug)),
    'active',
    COALESCE(NULLIF(trim(p_plan), ''), 'start'),
    p_subscription_end
  )
  RETURNING * INTO v_venue;

  INSERT INTO public.manager_venues (manager_id, venue_id)
  VALUES (v_user_id, v_venue.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.manager_venue_permissions (
    manager_id,
    venue_id,
    can_edit_menu
  )
  VALUES (
    v_user_id,
    v_venue.id,
    true
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (
    venue_id,
    plan_id,
    status,
    current_period_end
  )
  VALUES (
    v_venue.id,
    COALESCE(NULLIF(trim(p_plan), ''), 'start'),
    'trialing',
    p_subscription_end
  );

  RETURN v_venue;
END;
$function$;

-- Keep the newer 5-argument overload consistent for callers that pass products
-- directly to the RPC. It already inserts products under SECURITY DEFINER; the
-- important missing piece was the manager permission row.
CREATE OR REPLACE FUNCTION public.create_venue_for_manager(
  p_name text,
  p_slug text,
  p_plan text,
  p_subscription_end timestamp with time zone,
  p_products jsonb
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v public.venues;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('manager','admin')
  ) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.venues
    WHERE lower(slug) = lower(trim(p_slug))
  ) THEN
    RAISE EXCEPTION 'slug_exists';
  END IF;

  INSERT INTO public.venues(
    name, slug, status, plan, subscription_end
  )
  VALUES(
    trim(p_name),
    lower(trim(p_slug)),
    'active',
    coalesce(p_plan,'start'),
    p_subscription_end
  )
  RETURNING * INTO v;

  INSERT INTO public.manager_venues(manager_id, venue_id)
  VALUES(auth.uid(), v.id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.manager_venue_permissions(
    manager_id, venue_id, can_edit_menu
  )
  VALUES(auth.uid(), v.id, true)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions(
    venue_id, plan_id, status, current_period_end
  )
  VALUES(v.id, coalesce(p_plan,'start'), 'trialing', p_subscription_end);

  IF jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' THEN
    INSERT INTO public.products(
      venue_id, name, description, price, category,
      image_url, applies_to, is_available
    )
    SELECT
      v.id,
      x.name,
      x.description,
      coalesce(x.price,0),
      coalesce(x.category,'main'),
      x.image_url,
      coalesce(x.applies_to,'all'),
      coalesce(x.is_available,true)
    FROM jsonb_to_recordset(p_products) AS x(
      name text,
      description text,
      price numeric,
      category text,
      image_url text,
      applies_to text,
      is_available boolean
    );
  END IF;

  RETURN v;
END;
$function$;
