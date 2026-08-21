-- QR-Menu unified operational core verification
-- The corresponding migrations are already applied to Supabase project ulxfsozdryqrnlxzlblt.
-- Run this file in Supabase SQL Editor after deployment.

select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('venue_tables','table_sessions','manager_venue_permissions','order_status_history','operation_idempotency')
order by table_name;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='venue_tables'
order by ordinal_position;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='table_sessions'
order by ordinal_position;

select proname,pg_get_function_identity_arguments(oid) as args
from pg_proc
where pronamespace='public'::regnamespace
  and proname in (
    'manager_table_board','manager_move_table','manager_update_table',
    'staff_table_board','staff_reserve_table','staff_seat_table','staff_release_table','staff_create_session_order',
    'create_public_order_v2','public_table_by_qr','admin_global_analytics','manager_venue_analytics_v2'
  )
order by proname,args;

select count(*) as occupied_without_session
from public.venue_tables
where occupancy_status='occupied' and current_session_id is null;

select count(*) as active_session_without_table
from public.table_sessions s
where s.status='active'
  and not exists(select 1 from public.venue_tables t where t.current_session_id=s.id);

select count(*) as order_session_mismatch
from public.orders o
where o.table_session_id is not null
  and not exists(
    select 1 from public.table_sessions s
    where s.id=o.table_session_id
      and s.table_id=o.table_id
      and s.venue_id=o.venue_id
  );

select indexname,indexdef
from pg_indexes
where schemaname='public'
  and indexname in ('uq_table_sessions_one_active_per_table','uq_venue_tables_number_per_venue');
