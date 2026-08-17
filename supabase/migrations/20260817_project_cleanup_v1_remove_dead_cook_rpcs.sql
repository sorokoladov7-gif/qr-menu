-- These legacy cook RPCs are no longer referenced by the live cook.html.
-- The live kitchen uses staff_login, staff_orders_json, staff_history and staff_update_order.
DROP FUNCTION IF EXISTS public.cook_get_dashboard(text);
DROP FUNCTION IF EXISTS public.cook_login(text,text);
DROP FUNCTION IF EXISTS public.cook_orders(uuid);
DROP FUNCTION IF EXISTS public.cook_set_status(uuid,text);

-- Legacy unscoped table release RPC. Live workstations use cook_release_table
-- and waiter_release_table with staff tokens.
DROP FUNCTION IF EXISTS public.release_table(uuid);
