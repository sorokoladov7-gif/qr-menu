begin;

-- Staff history is private to the authenticated staff member within the venue.
-- Do not use display names as identity: two staff members can share the same name.
create or replace function public.staff_history_json(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  s public.staff_sessions;
  v_history jsonb;
  start_at timestamptz;
begin
  select * into s
  from public.staff_sessions
  where token = p_token
    and expires_at > now()
  limit 1;

  if s.id is null then
    return jsonb_build_object('error','invalid_session');
  end if;

  select started_at into start_at
  from public.staff_shifts
  where staff_type = s.staff_type
    and staff_id = s.staff_id
    and venue_id = s.venue_id
    and ended_at is null
  order by started_at desc
  limit 1;

  select jsonb_agg(o) into v_history
  from (
    select o.*,
      (select jsonb_agg(oi) from public.order_items oi where oi.order_id=o.id) items,
      (select jsonb_agg(oa) from public.order_addons oa where oa.order_id=o.id) addons
    from public.orders o
    where o.venue_id = s.venue_id
      and o.status = 'done'
      and exists (
        select 1
        from public.order_status_history h
        where h.order_id = o.id
          and h.venue_id = o.venue_id
          and h.actor_type = s.staff_type
          and h.actor_id = s.staff_id
          and h.new_status = 'done'
      )
      and (
        s.staff_type = 'waiter'
        or (s.staff_type in ('cook','courier') and start_at is not null and o.created_at >= start_at)
      )
    order by o.created_at desc
    limit 100
  ) o;

  return coalesce(v_history,'[]'::jsonb);
end;
$$;

commit;
