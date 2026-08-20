-- Harden only legacy/internal RPC entry points. Authenticated manager flows remain unchanged.

CREATE OR REPLACE FUNCTION public.generate_staff_pin()
RETURNS text
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT lpad((floor(random()*9000)+1000)::text, 4, '0')
$$;

REVOKE EXECUTE ON FUNCTION public.manager_can_manage_venue(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_create_staff(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_delete_table(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_staff_performance(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_save_design(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_table_board(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, uuid, text, timestamptz, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_venue_design_access(uuid, boolean) FROM anon;

-- The old waiter_add_order_to_table RPC uses the pre-session table model and is no longer
-- part of the current waiter flow (waiter_create_session_order is the active RPC).
REVOKE EXECUTE ON FUNCTION public.waiter_add_order_to_table(text, uuid, text, text, jsonb, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.waiter_add_order_to_table(text, uuid, text, text, jsonb, jsonb, text) FROM authenticated;
