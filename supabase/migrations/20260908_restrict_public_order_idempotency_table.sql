-- The public customer-order RPC is SECURITY DEFINER and is the only client entry point.
-- operation_idempotency must never be directly writable/readable by anon/authenticated.
begin;
revoke all privileges on table public.operation_idempotency from anon, authenticated;
grant all privileges on table public.operation_idempotency to service_role;
commit;
