begin;

create or replace function public.manager_support_mark_read(p_thread_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_manager_id uuid := auth.uid();
  v_count integer := 0;
begin
  if not exists(
    select 1 from public.manager_support_threads t
    where t.id=p_thread_id and t.manager_id=v_manager_id
  ) then
    raise exception 'THREAD_ACCESS_DENIED' using errcode='42501';
  end if;

  update public.manager_support_messages
  set read_at=now()
  where thread_id=p_thread_id
    and sender_role='admin'
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.manager_support_mark_read(uuid) to authenticated;

commit;
