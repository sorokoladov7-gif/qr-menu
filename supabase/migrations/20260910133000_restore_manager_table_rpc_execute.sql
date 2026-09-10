-- manager_upsert_table is a canonical manager-facing table mutation RPC.
-- Keep it callable only by authenticated users; the function itself enforces venue ownership.
grant execute on function public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, text) to authenticated;
revoke execute on function public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, text) from anon;
