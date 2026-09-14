begin;
revoke execute on function public.manager_support_set_typing(uuid,boolean) from anon;
revoke execute on function public.manager_support_mark_read(uuid) from anon;
revoke execute on function public.manager_support_get_typing(uuid) from anon;
revoke execute on function public.manager_support_set_status(uuid,text) from anon;
commit;
