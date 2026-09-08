-- Revoke public RPC execution for legacy customer/activity functions with no application callers.
-- The functions remain available to service_role for historical/internal tooling.
begin;
revoke execute on function public.customer_create_order(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.customer_create_order(uuid,uuid,text,text,text,text,text,text,jsonb) to service_role;
revoke execute on function public.track_activity(text,text) from public, anon, authenticated;
grant execute on function public.track_activity(text,text) to service_role;
commit;
