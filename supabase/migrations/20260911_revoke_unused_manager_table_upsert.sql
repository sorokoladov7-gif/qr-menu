begin;

-- The manager runtime now uses the canonical table mutation RPC family:
-- manager_create_table / manager_update_table / manager_move_table / manager_delete_table.
-- The historical upsert RPC is not referenced by the reorganized runtime and must
-- not remain an authenticated client mutation surface.
revoke execute on function public.manager_upsert_table(uuid, uuid, integer, text, integer, text, integer, integer)
  from public, anon, authenticated;

commit;
