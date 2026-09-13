begin;

revoke execute on function public.manager_support_broadcast(text,text) from anon;
revoke execute on function public.manager_support_mark_read(uuid) from anon;

grant execute on function public.manager_support_broadcast(text,text) to authenticated;
grant execute on function public.manager_support_mark_read(uuid) to authenticated;

commit;
