begin;
revoke execute on function public.manager_support_mark_read(uuid) from anon;
revoke execute on function public.manager_support_broadcast(text,text) from anon;
grant execute on function public.manager_support_mark_read(uuid) to authenticated;
grant execute on function public.manager_support_broadcast(text,text) to authenticated;
commit;
