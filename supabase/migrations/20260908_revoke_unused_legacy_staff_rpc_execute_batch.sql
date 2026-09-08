-- Security consolidation: these legacy RPCs have no current application callers.
-- Keep the functions for internal/service-role compatibility, but remove client execution.

begin;

revoke execute on function public.cook_recipe_catalog_v2(text) from public, anon, authenticated;
grant execute on function public.cook_recipe_catalog_v2(text) to service_role;

revoke execute on function public.staff_history(text) from public, anon, authenticated;
grant execute on function public.staff_history(text) to service_role;

revoke execute on function public.staff_orders(text) from public, anon, authenticated;
grant execute on function public.staff_orders(text) to service_role;

revoke execute on function public.waiter_get_table_dashboard(text) from public, anon, authenticated;
grant execute on function public.waiter_get_table_dashboard(text) to service_role;

revoke execute on function public.waiter_create_session_order(text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.waiter_create_session_order(text, uuid, jsonb, text) to service_role;

commit;
