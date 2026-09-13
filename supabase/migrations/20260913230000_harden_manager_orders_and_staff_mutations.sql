begin;

create or replace function public.manager_get_orders(
  p_venue_id uuid,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  if not public.manager_can_manage_venue(p_venue_id) then
    raise exception 'not_authorized';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(q) order by q.created_at desc)
    from (
      select o.*,
        coalesce((select jsonb_agg(to_jsonb(oi) order by oi.id) from public.order_items oi where oi.order_id=o.id), '[]'::jsonb) as items,
        coalesce((select jsonb_agg(to_jsonb(oa) order by oa.id) from public.order_addons oa where oa.order_id=o.id), '[]'::jsonb) as addons
      from public.orders o
      where o.venue_id=p_venue_id
      order by o.created_at desc
      limit v_limit
    ) q
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.manager_get_orders(uuid, integer) from public;
grant execute on function public.manager_get_orders(uuid, integer) to authenticated;

create or replace function public.manager_delete_staff(
  p_venue_id uuid,
  p_staff_id uuid,
  p_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := lower(trim(coalesce(p_type, '')));
  v_deleted boolean := false;
begin
  if not public.manager_can_manage_venue(p_venue_id) then
    raise exception 'not_authorized';
  end if;
  if v_type not in ('cook','courier','waiter') then
    raise exception 'invalid_staff_type';
  end if;
  if p_staff_id is null then
    raise exception 'staff_required';
  end if;

  if v_type='cook' then
    delete from public.cooks where id=p_staff_id and venue_id=p_venue_id;
  elsif v_type='courier' then
    delete from public.couriers where id=p_staff_id and venue_id=p_venue_id;
  else
    delete from public.waiters where id=p_staff_id and venue_id=p_venue_id;
  end if;
  v_deleted := found;

  if not v_deleted then
    raise exception 'staff_not_found';
  end if;

  return jsonb_build_object('ok',true,'staff_id',p_staff_id,'type',v_type,'deleted',true);
end;
$$;

revoke all on function public.manager_delete_staff(uuid, uuid, text) from public;
grant execute on function public.manager_delete_staff(uuid, uuid, text) to authenticated;

commit;
