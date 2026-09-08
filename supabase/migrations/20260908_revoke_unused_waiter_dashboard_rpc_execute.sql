begin;

-- waiter_get_dashboard(p_token) is a legacy dashboard RPC.
-- Current waiter PWA uses staff_table_board/staff_orders_json/staff_history_json
-- and the tokenized call RPCs; repository-wide caller tracing found no real
-- application call to waiter_get_dashboard. Keep the function for rollback/
-- historical compatibility, but remove direct client execution privileges.
revoke execute on function public.waiter_get_dashboard(text) from public, anon, authenticated;

commit;
