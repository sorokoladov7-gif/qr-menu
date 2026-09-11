-- Align the manager design RPC with the canonical manager_venue_permissions
-- permission source used by the AI/API layer and venue triggers.
CREATE OR REPLACE FUNCTION public.manager_save_design(p_venue_id uuid, p_design_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_manager_of(p_venue_id) THEN
    RAISE EXCEPTION 'Venue access denied';
  END IF;
  IF NOT public.manager_has_permission(p_venue_id,'edit_design') THEN
    RAISE EXCEPTION 'design_permission_required';
  END IF;
  UPDATE public.venues
  SET design_settings=coalesce(p_design_settings,'{}'::jsonb)
  WHERE id=p_venue_id;
  RETURN (SELECT design_settings FROM public.venues WHERE id=p_venue_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.manager_save_design(uuid,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.manager_save_design(uuid,jsonb) TO authenticated;
