-- Restrict admin-only DML policies from public to authenticated.
-- Admin actions already require auth.uid()/admin role, so anon can never satisfy them.
-- Keep public/anon SELECT policies unchanged for landing/menu access.

begin;

alter policy plans_admin_del on public.plans to authenticated;
alter policy plans_admin_ins on public.plans to authenticated;
alter policy plans_admin_upd on public.plans to authenticated;
alter policy venues_admin on public.venues to authenticated;

commit;
