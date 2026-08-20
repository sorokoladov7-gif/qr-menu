-- Remove PUBLIC execute inherited by anon/authenticated on privileged and legacy RPCs.
REVOKE EXECUTE ON FUNCTION public.manager_create_staff(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_delete_table(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_staff_performance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, uuid, text, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_close_table_session(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_save_design(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_table_board(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_venue_design_access(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.waiter_add_order_to_table(text, uuid, text, text, jsonb, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_staff_sessions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hash_staff_pin_on_write() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.manager_create_staff(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_delete_table(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_staff_performance(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_table_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_table_status(uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_reset_staff_pin(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_reset_staff_pin(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_close_table_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_save_design(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_table_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_venue_design_access(uuid, boolean) TO authenticated;

-- Legacy waiter RPC remains disabled for all client roles.
REVOKE EXECUTE ON FUNCTION public.waiter_add_order_to_table(text, uuid, text, text, jsonb, jsonb, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_staff_sessions() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_staff_pin_on_write() FROM anon, authenticated;
