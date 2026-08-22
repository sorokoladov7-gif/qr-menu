-- Deep functional audit: restore the intended manager/server privilege boundary.
-- Manager RPCs are called with the authenticated Supabase session.
-- Staff token flows and public QR/menu flows remain unchanged.

REVOKE EXECUTE ON FUNCTION public.manager_can_manage_venue(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_create_session_order(uuid, uuid, jsonb, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_create_table(uuid, integer, text, text, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_delete_hall_plan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_detailed_analytics(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_get_hall_plan(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_get_table_session_orders(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_ingredient_delete(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_ingredient_list(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_ingredient_upsert(uuid, text, text, numeric, numeric, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_next_table_number(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_product_recipe_save(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_recipe_cost(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_recipe_list(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_save_hall_plan(uuid, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_seat_table(uuid, uuid, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_reservation_guest(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_staff_performance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_venue_analytics_v2(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_save_design(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_table_board(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_update_table(uuid, uuid, integer, text, text, integer, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_move_table(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_close_table_session(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_delete_table(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_create_staff(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_reset_staff_pin(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_set_table_status(uuid, uuid, text, timestamptz, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_venue_design_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cook_can_control_tables(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_cook_activity(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_qr_guest_count_from_order() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.manager_create_session_order(uuid, uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_create_table(uuid, integer, text, text, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_delete_hall_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_detailed_analytics(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_get_hall_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_get_table_session_orders(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_ingredient_delete(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_ingredient_list(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_ingredient_upsert(uuid, text, text, numeric, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_next_table_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_product_recipe_save(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_recipe_cost(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_recipe_list(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_save_hall_plan(uuid, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_seat_table(uuid, uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_table_reservation_guest(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_staff_performance(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_venue_analytics_v2(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_save_design(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_table_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_update_table(uuid, uuid, integer, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_move_table(uuid, uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_close_table_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_delete_table(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_create_staff(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_reset_staff_pin(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_reset_staff_pin(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_table_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_set_table_status(uuid, uuid, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer) TO authenticated;

-- Internal helpers are not client endpoints.
REVOKE EXECUTE ON FUNCTION public.manager_can_manage_venue(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cook_can_control_tables(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.track_cook_activity(uuid, uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_qr_guest_count_from_order() FROM authenticated;
