revoke execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric,text) from public, authenticated;
grant execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric,text) to anon, service_role;
