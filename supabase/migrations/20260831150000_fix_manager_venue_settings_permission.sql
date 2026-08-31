-- Fix: manager cannot save basic venue settings because guard_venue_permission
-- requires a feature permission row even when the manager owns the venue.
-- Ownership of a venue is sufficient for basic venue settings (name,
-- description, address). Feature-specific permissions remain enforced.

CREATE OR REPLACE FUNCTION public.guard_venue_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_manager boolean := false;
BEGIN
  IF is_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT is_manager_of(NEW.id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_is_manager := true;

  -- A manager who owns the venue may edit its basic identity/settings.
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.address IS DISTINCT FROM OLD.address THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'venue_permission_required';
    END IF;
  END IF;

  -- Keep feature-specific permission checks intact.
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url
     OR NEW.brand_color IS DISTINCT FROM OLD.brand_color THEN
    IF NOT public.manager_has_permission(NEW.id,'edit_branding') THEN
      RAISE EXCEPTION 'branding_permission_required';
    END IF;
  END IF;

  IF NEW.design_settings IS DISTINCT FROM OLD.design_settings THEN
    IF NOT public.manager_has_permission(NEW.id,'edit_design') THEN
      RAISE EXCEPTION 'design_permission_required';
    END IF;
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
    IF NOT public.manager_has_permission(NEW.id,'edit_delivery') THEN
      RAISE EXCEPTION 'delivery_permission_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
