begin;

-- Final client-facing ACL firewall for the reorganized manager runtime.
-- These historical RPC contracts are intentionally outside the canonical
-- mutation boundary. Keep them available only to trusted server-side roles.
revoke execute on function public.manager_reset_staff_pin_v2(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.manager_global_ingredient_update(uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.manager_global_ingredient_delete(uuid)
  from public, anon, authenticated;
revoke execute on function public.manager_recipe_completeness_audit(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.manager_recipe_auto_sync(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.manager_reset_staff_pin(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.manager_set_table_status(uuid, text)
  from public, anon, authenticated;

commit;
