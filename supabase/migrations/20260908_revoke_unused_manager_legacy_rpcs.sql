-- Retire client execution rights for manager RPCs that are no longer part of the live client path.
-- Functions remain available to service_role for internal/backward-compatible use.
begin;
revoke execute on function public.manager_reset_staff_pin_v2(uuid,uuid,text) from public, anon, authenticated;
revoke execute on function public.manager_global_ingredient_update(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.manager_global_ingredient_delete(uuid) from public, anon, authenticated;
revoke execute on function public.manager_recipe_completeness_audit(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.manager_recipe_auto_sync(uuid,uuid) from public, anon, authenticated;
grant execute on function public.manager_reset_staff_pin_v2(uuid,uuid,text) to service_role;
grant execute on function public.manager_global_ingredient_update(uuid,text,text,text) to service_role;
grant execute on function public.manager_global_ingredient_delete(uuid) to service_role;
grant execute on function public.manager_recipe_completeness_audit(uuid,uuid) to service_role;
grant execute on function public.manager_recipe_auto_sync(uuid,uuid) to service_role;
commit;
