-- Table Session 2.0 security hardening.
REVOKE EXECUTE ON FUNCTION public.staff_can_control_tables(text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_table_board(uuid) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.manager_close_table_session(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manager_table_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_close_table_session(uuid,uuid) TO authenticated;
