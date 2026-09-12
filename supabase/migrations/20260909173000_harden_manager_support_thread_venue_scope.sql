begin;

create or replace function public.manager_support_get_or_create_thread(
  p_venue_id uuid default null,
  p_subject text default 'Поддержка'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_role text;
begin
  select p.role into v_role
  from public.profiles p
  where p.id=auth.uid();

  if v_role is distinct from 'manager' then
    raise exception 'MANAGER_ONLY' using errcode='42501';
  end if;

  if p_venue_id is not null and not exists(
    select 1
    from public.manager_venues mv
    where mv.manager_id=auth.uid()
      and mv.venue_id=p_venue_id
  ) then
    raise exception 'VENUE_ACCESS_DENIED' using errcode='42501';
  end if;

  select id into v_id
  from public.manager_support_threads
  where manager_id=auth.uid()
    and status<>'closed'
  order by last_message_at desc
  limit 1;

  if v_id is null then
    insert into public.manager_support_threads(manager_id,venue_id,subject)
    values(
      auth.uid(),
      p_venue_id,
      coalesce(nullif(trim(p_subject),''),'Поддержка')
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

grant execute on function public.manager_support_get_or_create_thread(uuid,text) to authenticated;

commit;
