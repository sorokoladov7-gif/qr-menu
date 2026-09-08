begin;

-- Canonical staff call API is token-protected. Client files were verified
-- to use the (venue_id, token) and (venue_id, call_id, token) signatures.
drop function if exists public.get_waiter_calls(uuid);
drop function if exists public.get_cook_calls(uuid);
drop function if exists public.resolve_waiter_call(uuid, uuid);
drop function if exists public.resolve_cook_call(uuid, uuid);

commit;
