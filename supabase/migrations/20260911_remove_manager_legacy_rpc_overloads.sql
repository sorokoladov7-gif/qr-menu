begin;

-- Runtime now uses the venue-scoped PIN reset signature and the
-- five-argument table-status RPC. The historical overloads are no longer
-- part of the manager-facing contract and must not remain callable by
-- authenticated clients.
revoke execute on function public.manager_reset_staff_pin(text, uuid) from public, anon, authenticated;
revoke execute on function public.manager_set_table_status(uuid, text) from public, anon, authenticated;

commit;
