alter table public.manager_support_threads add column if not exists pinned_at timestamptz null;
alter table public.manager_support_threads add column if not exists closed_at timestamptz null;

create or replace function public.manager_support_set_thread_state(p_thread_id uuid, p_status text default null, p_pinned boolean default null)
returns public.manager_support_threads
language plpgsql security definer set search_path=public
as $$
declare v_role text; v_row public.manager_support_threads;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'') <> 'admin' then raise exception 'forbidden'; end if;
 if p_status is not null and p_status not in ('open','in_progress','closed') then raise exception 'invalid_status'; end if;
 update public.manager_support_threads set
   status=coalesce(p_status,status),
   pinned_at=case when p_pinned is null then pinned_at when p_pinned then coalesce(pinned_at,now()) else null end,
   closed_at=case when p_status='closed' then now() when p_status is not null then null else closed_at end,
   updated_at=now()
 where id=p_thread_id returning * into v_row;
 if not found then raise exception 'thread_not_found'; end if;
 return v_row;
end;
$$;

grant execute on function public.manager_support_set_thread_state(uuid,text,boolean) to authenticated;
revoke execute on function public.manager_support_set_thread_state(uuid,text,boolean) from anon;

create or replace function public.manager_support_broadcast_targeted(p_subject text, p_message text, p_manager_ids uuid[])
returns integer
language plpgsql security definer set search_path=public
as $$
declare v_role text; v_manager uuid; v_thread uuid; v_count integer:=0; v_text text; v_subject text;
begin
 select role into v_role from public.profiles where id=auth.uid();
 if coalesce(v_role,'') <> 'admin' then raise exception 'forbidden'; end if;
 v_subject=left(trim(coalesce(p_subject,'')),160); v_text=left(trim(coalesce(p_message,'')),10000);
 if v_text='' then raise exception 'message_required'; end if;
 if p_manager_ids is null or cardinality(p_manager_ids)=0 then raise exception 'recipients_required'; end if;
 foreach v_manager in array p_manager_ids loop
   if exists(select 1 from public.profiles where id=v_manager and role='manager') then
     select id into v_thread from public.manager_support_threads where manager_id=v_manager and status <> 'closed' order by last_message_at desc nulls last limit 1;
     if v_thread is null then
       insert into public.manager_support_threads(manager_id,subject,status,last_message_at,updated_at) values(v_manager,coalesce(nullif(v_subject,''),'Сообщение администратора'),'in_progress',now(),now()) returning id into v_thread;
     end if;
     insert into public.manager_support_messages(thread_id,sender_role,sender_id,message,created_at) values(v_thread,'admin',auth.uid(),case when v_subject<>'' then '📢 '||v_subject||E'\n'||v_text else '📢 '||v_text end,now());
     update public.manager_support_threads set status='in_progress',last_message_at=now(),updated_at=now(),closed_at=null where id=v_thread;
     v_count:=v_count+1;
   end if;
 end loop;
 return v_count;
end;
$$;

grant execute on function public.manager_support_broadcast_targeted(text,text,uuid[]) to authenticated;
revoke execute on function public.manager_support_broadcast_targeted(text,text,uuid[]) from anon;
