begin;

-- Consolidate SECURITY DEFINER execution ACLs for token-bearing staff RPCs.
-- The anonymous PWA still calls these functions, so anon/authenticated grants remain
-- unchanged. PUBLIC is revoked explicitly to avoid broad inherited EXECUTE access.
revoke execute on function public.close_staff_shift(text) from public;
revoke execute on function public.close_venue_day(text) from public;
revoke execute on function public.cook_get_table_dashboard(text) from public;
revoke execute on function public.cook_recipe_catalog(text) from public;
revoke execute on function public.cook_recipe_resync_missing(text) from public;
revoke execute on function public.cook_recipe_sync(text) from public;
revoke execute on function public.cook_recipe_sync_safe_v2(text) from public;
revoke execute on function public.cook_release_table(text,uuid) from public;
revoke execute on function public.cook_reserve_table(text,uuid,timestamptz,text) from public;
revoke execute on function public.cook_start_table_session(text,uuid) from public;
revoke execute on function public.cook_sync_unambiguous_recipe_ingredients(text,uuid) from public;
revoke execute on function public.get_cook_calls(uuid,text) from public;
revoke execute on function public.get_staff_shift(text) from public;
revoke execute on function public.get_staff_workday(text) from public;
revoke execute on function public.get_waiter_calls(uuid,text) from public;
revoke execute on function public.open_staff_shift(text) from public;
revoke execute on function public.reset_staff_workday(text) from public;
revoke execute on function public.resolve_cook_call(uuid,uuid,text) from public;
revoke execute on function public.resolve_waiter_call(uuid,uuid,text) from public;
revoke execute on function public.staff_close_table_session(text,uuid) from public;
revoke execute on function public.staff_create_session_order(text,uuid,text,text,text,jsonb,jsonb,text) from public;
revoke execute on function public.staff_edit_order(text,uuid,jsonb,jsonb,text) from public;
revoke execute on function public.staff_edit_order(text,uuid,jsonb,text) from public;
revoke execute on function public.staff_history_json(text) from public;
revoke execute on function public.staff_orders_json(text) from public;
revoke execute on function public.staff_release_table(text,uuid) from public;
revoke execute on function public.staff_reserve_table(text,uuid,timestamptz,text,text,text) from public;
revoke execute on function public.staff_seat_table(text,uuid,integer,text,text) from public;
revoke execute on function public.staff_start_table_session(text,uuid) from public;
revoke execute on function public.staff_table_board(text) from public;
revoke execute on function public.staff_update_order(text,uuid,text) from public;
revoke execute on function public.staff_venue_by_slug(text) from public;
revoke execute on function public.waiter_login(text,text) from public;
revoke execute on function public.waiter_release_table(text,uuid) from public;
revoke execute on function public.waiter_reserve_table(text,uuid,timestamptz,text) from public;
revoke execute on function public.waiter_start_table_session(text,uuid) from public;
revoke execute on function public.waiter_table_products(text) from public;

-- Delivery calculation is intentionally anonymous, but should not inherit EXECUTE via PUBLIC.
revoke execute on function public.calc_delivery_fee(uuid,double precision,double precision) from public;

-- Customer table-call endpoints remain anonymous, but execution is explicit to anon/authenticated.
revoke execute on function public.create_cook_call(uuid,text) from public;
revoke execute on function public.create_waiter_call(uuid,text) from public;

commit;
