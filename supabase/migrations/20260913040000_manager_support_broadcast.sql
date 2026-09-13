begin;

create table if not exists public.manager_support_broadcasts(
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'Объявление платформы',
  message text not null,
  recipients_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists manager_support_broadcasts_created_idx
  on public.manager_support_broadcasts(created_at desc);

alter table public.manager_support_broadcasts enable row level security;

drop policy if exists manager_support_broadcasts_admin on public.manager_support_broadcasts;
create policy manager_support_broadcasts_admin
on public.manager_support_broadcasts
for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.manager_support_broadcast(
  p_subject text default 'Объявление платформы',
  p_message text default ''
)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_thread_id uuid;
  v_count integer := 0;
  v_subject text := coalesce(nullif(trim(p_subject),''),'Объявление платформы');
  v_message text := left(trim(coalesce(p_message,'')),8000);
  v_broadcast_id uuid;
  m record;
begin
  if not exists(select 1 from public.profiles p where p.id=v_admin_id and p.role='admin') then
    raise exception 'ADMIN_ONLY' using errcode='42501';
  end if;
  if length(v_message)=0 then
    raise exception 'MESSAGE_REQUIRED';
  end if;

  insert into public.manager_support_broadcasts(admin_id,subject,message)
  values(v_admin_id,left(v_subject,180),v_message)
  returning id into v_broadcast_id;

  for m in select id from public.profiles where role='manager' loop
    select id into v_thread_id
    from public.manager_support_threads
    where manager_id=m.id and status<>'closed'
    order by last_message_at desc
    limit 1;

    if v_thread_id is null then
      insert into public.manager_support_threads(manager_id,subject,status,last_message_at,updated_at)
      values(m.id,'Поддержка платформы','in_progress',now(),now())
      returning id into v_thread_id;
    end if;

    insert into public.manager_support_messages(thread_id,sender_id,sender_role,message)
    values(v_thread_id,v_admin_id,'admin', '📢 ' || v_subject || E'\n\n' || v_message);

    update public.manager_support_threads
    set last_message_at=now(),updated_at=now(),status='in_progress'
    where id=v_thread_id;

    v_count := v_count + 1;
  end loop;

  update public.manager_support_broadcasts
  set recipients_count=v_count
  where id=v_broadcast_id;

  return v_count;
end;
$$;

grant execute on function public.manager_support_broadcast(text,text) to authenticated;

commit;