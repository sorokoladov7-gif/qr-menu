-- get_public_order is a legacy wrapper around customer_track_order_json.
-- No application caller was found; the canonical customer tracking RPC remains public/anon.
begin;
revoke execute on function public.get_public_order(uuid,text) from public, anon, authenticated;
grant execute on function public.get_public_order(uuid,text) to service_role;
commit;
