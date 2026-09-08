-- Harden SECURITY DEFINER delivery-manager RPCs against ambient search_path changes.
-- No behavior or authorization semantics are changed.
alter function public.manager_delivery_integration_delete(uuid,text) set search_path = public;
alter function public.manager_delivery_integration_upsert(uuid,text,boolean,integer,text,numeric,numeric,text,jsonb) set search_path = public;
alter function public.manager_delivery_integrations_list(uuid) set search_path = public;
