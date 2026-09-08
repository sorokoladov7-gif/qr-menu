begin;

-- The production Manager AI action endpoint enforces the ±10% price rule server-side.
-- This standalone RPC has no repository callers or database dependencies, so remove it
-- instead of keeping a redundant security layer.
drop function if exists public.manager_ai_validate_price_change(uuid,numeric);

commit;
