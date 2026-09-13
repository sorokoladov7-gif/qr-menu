begin;

-- Smart Table 2.0: authoritative guest/session synchronization.
-- The QR token is used only to establish table identity; the guest token is
-- subsequently used to resolve the currently active table_session server-side.
create or replace function public.smart_table_guest_sync(
  p_qr_token text,
  p_guest_token text,
  p_language text default 'ru'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_table public.venue_tables%rowtype;
  v_guest public.table_guest_sessions%rowtype;
  v_session public.table_sessions%rowtype;
  v_context jsonb;
  v_orders jsonb;
begin
  if nullif(trim(p_qr_token),'') is null then raise exception 'qr_token_required'; end if;
  if nullif(trim(p_guest_token),'') is null then raise exception 'guest_token_required'; end if;

  select * into v_table
    from public.venue_tables
   where qr_token=trim(p_qr_token)
     and is_active=true
   limit 1;
  if v_table.id is null then raise exception 'table_not_found'; end if;

  select * into v_guest
    from public.table_guest_sessions
   where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex')
     and left_at is null
   order by joined_at desc
   limit 1;

  if v_guest.id is not null then
    select * into v_session
      from public.table_sessions
     where id=v_guest.table_session_id
       and status='active';

    if v_session.id is null or v_session.table_id<>v_table.id then
      v_guest.id:=null;
    end if;
  end if;

  if v_guest.id is null then
    return jsonb_build_object(
      'ok',true,
      'joined',false,
      'session_id',null,
      'guest_id',null,
      'context',public.smart_table_context(v_table.venue_id,p_qr_token,p_language),
      'orders','[]'::jsonb
    );
  end if;

  update public.table_guest_sessions
     set last_seen_at=now()
   where id=v_guest.id;

  v_context:=public.smart_table_context(v_table.venue_id,p_qr_token,p_language);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,
    'status',o.status,
    'order_type',o.order_type,
    'created_at',o.created_at,
    'updated_at',o.updated_at,
    'total_price',coalesce(o.total_price,0)
  ) order by o.created_at desc),'[]'::jsonb)
    into v_orders
    from public.orders o
   where o.table_id=v_table.id
     and o.table_session_id=v_guest.table_session_id
     and o.status not in ('done','cancelled');

  return jsonb_build_object(
    'ok',true,
    'joined',true,
    'session_id',v_guest.table_session_id,
    'guest_id',v_guest.id,
    'context',v_context,
    'orders',v_orders
  );
end;
$$;

grant execute on function public.smart_table_guest_sync(text,text,text) to anon,authenticated;

commit;
