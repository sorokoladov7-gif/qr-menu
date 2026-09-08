begin;

-- Repository-wide search found no application callers for these legacy recipe-sync RPCs.
-- Keep the functions for compatibility/history, but remove client execution access.
revoke execute on function public.cook_recipe_sync(text) from anon, authenticated;
revoke execute on function public.cook_recipe_sync_by_token(text) from anon, authenticated;

commit;
