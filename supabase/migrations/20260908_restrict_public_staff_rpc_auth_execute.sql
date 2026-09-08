-- Public/customer and staff-entry RPCs are consumed by the anon PWA/public menu.
-- Authenticated execution is unnecessary and expands the SECURITY DEFINER surface.
begin;
revoke execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric) from authenticated;
revoke execute on function public.public_attach_order_modifiers(uuid,text,jsonb) from authenticated;
revoke execute on function public.append_public_order_addons(uuid,text,jsonb) from authenticated;
revoke execute on function public.customer_track_order_json(uuid,text) from authenticated;
revoke execute on function public.staff_login(text,text,text) from authenticated;
commit;
