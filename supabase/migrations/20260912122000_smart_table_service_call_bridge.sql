begin;

create or replace function public.smart_table_service_request(p_guest_token text,p_request_type text,p_message text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_table public.venue_tables%rowtype; v_id uuid; v_call_id uuid;
begin
  if p_request_type not in ('waiter','bill','more','water','allergy','review') then raise exception 'invalid_service_request'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select * into v_table from public.venue_tables where id=(select table_id from public.table_sessions where id=v_guest.table_session_id) limit 1;
  insert into public.table_service_requests(table_session_id,guest_id,request_type,message)
    values(v_guest.table_session_id,v_guest.id,p_request_type,nullif(trim(p_message),'')) returning id into v_id;
  if p_request_type in ('waiter','bill','more','water','allergy') then
    insert into public.waiter_calls(venue_id,table_number,status,created_at)
      values((select venue_id from public.table_sessions where id=v_guest.table_session_id),v_table.table_number,'pending',now())
      returning id into v_call_id;
  end if;
  return jsonb_build_object('ok',true,'request_id',v_id,'waiter_call_id',v_call_id);
end;
$$;

grant execute on function public.smart_table_service_request(text,text,text) to anon,authenticated;

commit;
