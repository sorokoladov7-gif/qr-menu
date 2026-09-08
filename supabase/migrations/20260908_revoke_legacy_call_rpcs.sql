-- Remove EXECUTE access from legacy call RPCs that are no longer referenced by the application.
-- Active staff call flow uses get_cook_calls/get_waiter_calls and resolve_cook_call/resolve_waiter_call.
-- Keep the legacy functions available for historical compatibility, but do not expose them to client roles.

revoke execute on function public.cook_calls(uuid) from anon, authenticated;
revoke execute on function public.waiter_calls(uuid) from anon, authenticated;
revoke execute on function public.cook_call(uuid, uuid) from anon, authenticated;
revoke execute on function public.waiter_call(uuid, uuid) from anon, authenticated;
