begin;

-- Staff token RPCs are authenticated by their own staff_sessions token.
-- The staff PWA uses the anonymous Supabase role; signed-in manager/admin
-- sessions must not gain an additional execution path to these SECURITY DEFINER RPCs.
-- Keep anon access where the staff PWA requires it.

revoke execute on function public.close_staff_shift(text) from authenticated;
revoke execute on function public.close_venue_day(text) from authenticated;
revoke execute on function public.cook_get_table_dashboard(text) from authenticated;
revoke execute on function public.cook_recipe_catalog(text) from authenticated;
revoke execute on function public.cook_recipe_resync_missing(text) from authenticated;
revoke execute on function public.cook_recipe_sync(text) from authenticated;
revoke execute on function public.cook_recipe_sync_safe_v2(text) from authenticated;
revoke execute on function public.cook_release_table(text,uuid) from authenticated;
revoke execute on function public.cook_reserve_table(text,uuid,timestamptz,text) from authenticated;
revoke execute on function public.cook_start_table_session(text,uuid) from authenticated;
revoke execute on function public.cook_sync_unambiguous_recipe_ingredients(text,uuid) from authenticated;
revoke execute on function public.get_cook_calls(uuid,text) from authenticated;
revoke execute on function public.get_staff_shift(text) from authenticated;
revoke execute on function public.get_staff_workday(text) from authenticated;
revoke execute on function public.get_waiter_calls(uuid,text) from authenticated;
revoke execute on function public.open_staff_shift(text) from authenticated;
revoke execute on function public.reset_staff_workday(text) from authenticated;
revoke execute on function public.resolve_cook_call(uuid,uuid,text) from authenticated;
revoke execute on function public.resolve_waiter_call(uuid,uuid,text) from authenticated;
revoke execute on function public.staff_close_table_session(text,uuid) from authenticated;
revoke execute on function public.staff_create_session_order(text,uuid,text,text,text,jsonb,jsonb,text) from authenticated;
revoke execute on function public.staff_edit_order(text,uuid,jsonb,jsonb,text) from authenticated;
revoke execute on function public.staff_edit_order(text,uuid,jsonb,text) from authenticated;
revoke execute on function public.staff_history_json(text) from authenticated;
revoke execute on function public.staff_orders_json(text) from authenticated;
revoke execute on function public.staff_release_table(text,uuid) from authenticated;
revoke execute on function public.staff_reserve_table(text,uuid,timestamptz,text,text,text) from authenticated;
revoke execute on function public.staff_seat_table(text,uuid,integer,text,text) from authenticated;
revoke execute on function public.staff_start_table_session(text,uuid) from authenticated;
revoke execute on function public.staff_table_board(text) from authenticated;
revoke execute on function public.staff_update_order(text,uuid,text) from authenticated;
revoke execute on function public.staff_venue_by_slug(text) from authenticated;
revoke execute on function public.staff_login(text,text,text) from authenticated;
revoke execute on function public.staff_logout(text) from authenticated;
revoke execute on function public.staff_session(text) from authenticated;
revoke execute on function public.waiter_login(text,text) from authenticated;
revoke execute on function public.waiter_release_table(text,uuid) from authenticated;
revoke execute on function public.waiter_reserve_table(text,uuid,timestamptz,text) from authenticated;
revoke execute on function public.waiter_start_table_session(text,uuid) from authenticated;
revoke execute on function public.waiter_table_products(text) from authenticated;

commit;
