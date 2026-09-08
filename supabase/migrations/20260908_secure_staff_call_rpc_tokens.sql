begin;

create or replace function public.get_waiter_calls(p_venue_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_sessions ss
    where ss.token = p_token
      and ss.venue_id = p_venue_id
      and ss.staff_type = 'waiter'
      and ss.expires_at > now()
  ) then
    raise exception 'STAFF_SESSION_INVALID';
  end if;

  return coalesce(
    (select jsonb_agg(jsonb_build_object('id', wc.id, 'table_number', wc.table_number, 'created_at', wc.created_at) order by wc.created_at desc)
       from public.waiter_calls wc
      where wc.venue_id = p_venue_id and wc.status = 'pending'),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.get_cook_calls(p_venue_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_sessions ss
    where ss.token = p_token
      and ss.venue_id = p_venue_id
      and ss.staff_type = 'cook'
      and ss.expires_at > now()
  ) then
    raise exception 'STAFF_SESSION_INVALID';
  end if;

  return coalesce(
    (select jsonb_agg(jsonb_build_object('id', cc.id, 'table_number', cc.table_number, 'created_at', cc.created_at) order by cc.created_at desc)
       from public.cook_calls cc
      where cc.venue_id = p_venue_id and cc.status = 'pending'),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.resolve_waiter_call(p_venue_id uuid, p_call_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_sessions ss
    where ss.token = p_token
      and ss.venue_id = p_venue_id
      and ss.staff_type = 'waiter'
      and ss.expires_at > now()
  ) then
    raise exception 'STAFF_SESSION_INVALID';
  end if;

  update public.waiter_calls
     set status = 'resolved', resolved_at = now()
   where id = p_call_id and venue_id = p_venue_id and status = 'pending';

  if not found then
    return jsonb_build_object('success', false, 'error', 'CALL_NOT_FOUND');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.resolve_cook_call(p_venue_id uuid, p_call_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.staff_sessions ss
    where ss.token = p_token
      and ss.venue_id = p_venue_id
      and ss.staff_type = 'cook'
      and ss.expires_at > now()
  ) then
    raise exception 'STAFF_SESSION_INVALID';
  end if;

  update public.cook_calls
     set status = 'resolved', resolved_at = now()
   where id = p_call_id and venue_id = p_venue_id and status = 'pending';

  if not found then
    return jsonb_build_object('success', false, 'error', 'CALL_NOT_FOUND');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.get_waiter_calls(uuid, text) to anon, authenticated;
grant execute on function public.get_cook_calls(uuid, text) to anon, authenticated;
grant execute on function public.resolve_waiter_call(uuid, uuid, text) to anon, authenticated;
grant execute on function public.resolve_cook_call(uuid, uuid, text) to anon, authenticated;

commit;
