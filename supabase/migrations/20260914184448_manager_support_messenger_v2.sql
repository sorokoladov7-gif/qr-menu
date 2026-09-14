begin;

create table if not exists public.manager_support_typing (
  thread_id uuid not null references public.manager_support_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null check(sender_role in ('manager','admin')),
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(thread_id,user_id)
);
create index if not exists manager_support_typing_thread_idx on public.manager_support_typing(thread_id,updated_at desc);
alter table public.manager_support_typing enable row level security;
drop policy if exists manager_support_typing_select on public.manager_support_typing;
create policy manager_support_typing_select on public.manager_support_typing for select to authenticated using (
  exists(select 1 from public.manager_support_threads t where t.id=thread_id and t.manager_id=auth.uid())
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
);
grant select on public.manager_support_typing to authenticated;

create or replace function public.manager_support_set_typing(p_thread_id uuid,p_is_typing boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
  select case when p.role='admin' then 'admin' else 'manager' end into v_role from public.profiles p where p.id=auth.uid() and p.role in ('admin','manager');
  if v_role is null then raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end if;
  if v_role='manager' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id and t.manager_id=auth.uid()) then raise exception 'THREAD_ACCESS_DENIED' using errcode='42501'; end if;
  if v_role='admin' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id) then raise exception 'THREAD_NOT_FOUND'; end if;
  insert into public.manager_support_typing(thread_id,user_id,sender_role,is_typing,updated_at) values(p_thread_id,auth.uid(),v_role,coalesce(p_is_typing,false),now()) on conflict(thread_id,user_id) do update set sender_role=excluded.sender_role,is_typing=excluded.is_typing,updated_at=now();
end; $$;
grant execute on function public.manager_support_set_typing(uuid,boolean) to authenticated;

create or replace function public.manager_support_mark_read(p_thread_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_role text; v_count integer;
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.role in ('admin','manager');
  if v_role is null then raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end if;
  if v_role='manager' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id and t.manager_id=auth.uid()) then raise exception 'THREAD_ACCESS_DENIED'; end if;
  if v_role='admin' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id) then raise exception 'THREAD_NOT_FOUND'; end if;
  update public.manager_support_messages set read_at=coalesce(read_at,now()) where thread_id=p_thread_id and sender_role<>v_role and read_at is null;
  get diagnostics v_count=row_count; return v_count;
end; $$;
grant execute on function public.manager_support_mark_read(uuid) to authenticated;

create or replace function public.manager_support_get_typing(p_thread_id uuid)
returns table(sender_role text,is_typing boolean,updated_at timestamptz) language sql security definer set search_path=public as $$
  select x.sender_role,x.is_typing,x.updated_at from public.manager_support_typing x where x.thread_id=p_thread_id and x.updated_at>now()-interval '5 seconds' and x.is_typing=true;
$$;
grant execute on function public.manager_support_get_typing(uuid) to authenticated;

create or replace function public.manager_support_set_status(p_thread_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
  if p_status not in ('open','in_progress','closed') then raise exception 'INVALID_STATUS'; end if;
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.role in ('admin','manager');
  if v_role is null then raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end if;
  if v_role='manager' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id and t.manager_id=auth.uid()) then raise exception 'THREAD_ACCESS_DENIED'; end if;
  if v_role='admin' and not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id) then raise exception 'THREAD_NOT_FOUND'; end if;
  update public.manager_support_threads set status=p_status,updated_at=now() where id=p_thread_id;
end; $$;
grant execute on function public.manager_support_set_status(uuid,text) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='manager_support_messages') then alter publication supabase_realtime add table public.manager_support_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='manager_support_typing') then alter publication supabase_realtime add table public.manager_support_typing; end if;
end $$;

commit;
