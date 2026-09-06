-- Fix manager ingredient loading when a single-venue manager has a stale localStorage venue id.
-- Keeps the security boundary: a manager can only read their assigned venue.

CREATE OR REPLACE FUNCTION public.manager_ingredient_list(p_venue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_manager uuid := auth.uid();
  v_effective_venue_id uuid := p_venue_id;
  v_is_admin boolean := false;
  v_manager_venue_count integer := 0;
  v_result jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_manager AND p.role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    v_effective_venue_id := p_venue_id;
  ELSE
    SELECT count(*) INTO v_manager_venue_count
    FROM public.manager_venues mv
    WHERE mv.manager_id = v_manager;

    IF EXISTS (
      SELECT 1 FROM public.manager_venues mv
      WHERE mv.manager_id = v_manager
        AND mv.venue_id = p_venue_id
    ) THEN
      v_effective_venue_id := p_venue_id;
    ELSIF v_manager_venue_count = 1 THEN
      SELECT mv.venue_id INTO v_effective_venue_id
      FROM public.manager_venues mv
      WHERE mv.manager_id = v_manager
      LIMIT 1;
    ELSE
      RAISE EXCEPTION 'forbidden';
    END IF;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'unit', i.unit,
        'purchase_quantity', i.purchase_quantity,
        'purchase_price', i.purchase_price,
        'is_active', i.is_active
      ) ORDER BY i.name
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.ingredients i
  WHERE i.venue_id = v_effective_venue_id
    AND i.is_active = true;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.manager_ingredient_list(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_ingredient_list(uuid) TO authenticated;
