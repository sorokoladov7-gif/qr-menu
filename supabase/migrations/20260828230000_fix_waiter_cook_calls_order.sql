-- QR Menu — fix waiter/cook call list RPCs
-- Purpose: return active calls ordered by creation time without GROUP BY errors.

begin;

create or replace function public.get_waiter_calls(p_venue_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', wc.id,
        'table_number', wc.table_number,
        'created_at', wc.created_at
      ) order by wc.created_at desc
    ),
    '[]'::jsonb
  )
  from public.waiter_calls wc
  where wc.venue_id = p_venue_id
    and wc.status = 'pending';
$$;

create or replace function public.get_cook_calls(p_venue_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cc.id,
        'table_number', cc.table_number,
        'created_at', cc.created_at
      ) order by cc.created_at desc
    ),
    '[]'::jsonb
  )
  from public.cook_calls cc
  where cc.venue_id = p_venue_id
    and cc.status = 'pending';
$$;

commit;
