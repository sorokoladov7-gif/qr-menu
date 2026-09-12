begin;

-- A manager may only associate a newly created support thread with a venue they manage.
-- Keep the existing nullable venue behavior for general manager support.
create or replace function public.manager_support_get_or_create_thread(
  p_venue_id uuid default null,
  p_subject text default 'Поддержка'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'manager'
  ) then
    raise exception 'MANAGER_ONLY' using errcode='42501';
  end if;

  if p_venue_id is not null and not public.is_manager_of(p_venue_id) then
    raise exception 'VENUE_ACCESS_DENIED' using errcode='42501';
  end if;

  select id
    into v_id
  from public.manager_support_threads
  where manager_id = auth.uid()
    and status <> 'closed'
  order by last_message_at desc
  limit 1;

  if v_id is null then
    insert into public.manager_support_threads(manager_id, venue_id, subject)
    values (
      auth.uid(),
      p_venue_id,
      coalesce(nullif(trim(p_subject),''),'Поддержка')
    )
    returning id into v_id;
  end if;

  return v_id;
end;
$function$;

commit;
