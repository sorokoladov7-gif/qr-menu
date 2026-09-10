begin;

-- These legacy compatibility RPCs have no active application caller.
-- Keep the function definitions for migration/history compatibility, but remove
-- anonymous Data API reachability. The current staff PWA uses staff_login and
-- the canonical staff_* RPCs instead.
revoke execute on function public.waiter_login(text,text) from public, anon, authenticated;
revoke execute on function public.cook_recipe_sync_safe_v2(text) from public, anon, authenticated;

grant execute on function public.waiter_login(text,text) to service_role;
grant execute on function public.cook_recipe_sync_safe_v2(text) to service_role;

commit;
