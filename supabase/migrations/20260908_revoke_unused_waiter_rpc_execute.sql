begin;

-- No application callers found for these legacy waiter RPCs.
-- Keep the functions, remove client execution access only.
revoke execute on function public.waiter_get_menu(text) from anon, authenticated;
revoke execute on function public.waiter_get_orders(text) from anon, authenticated;

commit;
