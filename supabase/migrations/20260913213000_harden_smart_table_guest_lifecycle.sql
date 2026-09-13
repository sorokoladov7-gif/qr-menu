begin;

-- Smart Table 2.0 lifecycle hardening:
-- when a table session closes, every guest belonging to that session is
-- immediately marked as left. This makes the closed session unusable from
-- every existing guest RPC, because those RPCs already require left_at IS NULL.
create or replace function public.smart_table_close_guest_sessions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status='closed' and old.status is distinct from 'closed' then
    update public.table_guest_sessions
       set left_at=coalesce(left_at,coalesce(new.closed_at,now())),
           last_seen_at=now()
     where table_session_id=new.id
       and left_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_smart_table_close_guest_sessions on public.table_sessions;
create trigger trg_smart_table_close_guest_sessions
after update of status on public.table_sessions
for each row
execute function public.smart_table_close_guest_sessions();

-- Backfill any already-closed sessions whose guests were left active by an
-- older version of the lifecycle implementation.
update public.table_guest_sessions g
   set left_at=coalesce(ts.closed_at,now()),
       last_seen_at=now()
  from public.table_sessions ts
 where ts.id=g.table_session_id
   and ts.status='closed'
   and g.left_at is null;

-- The guest sync endpoint remains server-authoritative: an active guest must
-- belong to the table's currently active session. Closed sessions therefore
-- return joined=false and no active orders.
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

  if v_table.current_session_id is not null then
    select * into v_session
      from public.table_sessions
     where id=v_table.current_session_id
       and status='active';
  end if;

  select * into v_guest
    from public.table_guest_sessions
   where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex')
     and left_at is null
   order by joined_at desc
   limit 1;

  if v_guest.id is not null and (v_session.id is null or v_guest.table_session_id<>v_session.id) then
    v_guest.id:=null;
  end if;

  v_context:=public.smart_table_context(v_table.venue_id,p_qr_token,p_language);

  if v_guest.id is null then
    return jsonb_build_object(
      'ok',true,
      'joined',false,
      'session_status',case when v_session.id is null then 'closed' else v_session.status end,
      'session_id',null,
      'guest_id',null,
      'context',v_context,
      'orders','[]'::jsonb
    );
  end if;

  update public.table_guest_sessions
     set last_seen_at=now()
   where id=v_guest.id;

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
    'session_status',v_session.status,
    'session_id',v_guest.table_session_id,
    'guest_id',v_guest.id,
    'context',v_context,
    'orders',v_orders
  );
end;
$$;

grant execute on function public.smart_table_guest_sync(text,text,text) to anon,authenticated;

commit;
