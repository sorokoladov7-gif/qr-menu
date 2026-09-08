begin;

-- get_activity_history is admin-only internally and has no repository caller.
-- Remove public/authenticated EXECUTE so the RPC cannot be probed by ordinary users.
revoke execute on function public.get_activity_history(integer) from public, anon, authenticated;

commit;
