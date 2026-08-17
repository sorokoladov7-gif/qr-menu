-- PROJECT CLEANUP v1
-- Remove only legacy tables proven disconnected from the current QR Menu model.
-- Verified before this migration: no public RPC function references these tables,
-- no current core-table FK depends on them, and the tables are outside the active venue/order/staff model.

DROP TABLE IF EXISTS public.request_items CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.workers CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;

-- Remove duplicate/legacy policies while preserving the active manager/admin policies.
DROP POLICY IF EXISTS "Админ видит всё" ON public.venues;
DROP POLICY IF EXISTS "Админ всё" ON public.venues;
DROP POLICY IF EXISTS "manager update venues" ON public.venues;
DROP POLICY IF EXISTS plans_select ON public.plans;
DROP POLICY IF EXISTS plans_admin_write ON public.plans;
DROP POLICY IF EXISTS products_admin_all ON public.products;
DROP POLICY IF EXISTS orders_admin_sel ON public.orders;
