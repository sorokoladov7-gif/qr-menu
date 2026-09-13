begin;

create or replace function public.manager_update_order(
  p_venue_id uuid,
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_updated boolean := false;
  v_row jsonb;
begin
  if not public.manager_can_manage_venue(p_venue_id) then
    raise exception 'not_authorized';
  end if;
  if p_order_id is null then
    raise exception 'order_required';
  end if;
  if v_status not in ('new','cooking','ready','delivery','arrived','done','cancelled','changed') then
    raise exception 'invalid_order_status';
  end if;

  if v_status='cooking' then
    update public.orders
      set status=v_status, cooking_started_at=coalesce(cooking_started_at, now())
    where id=p_order_id and venue_id=p_venue_id;
  elsif v_status='ready' then
    update public.orders
      set status=v_status, ready_at=coalesce(ready_at, now())
    where id=p_order_id and venue_id=p_venue_id;
  else
    update public.orders
      set status=v_status
    where id=p_order_id and venue_id=p_venue_id;
  end if;

  v_updated := found;
  if not v_updated then
    raise exception 'order_not_found';
  end if;

  select to_jsonb(o) into v_row
  from public.orders o
  where o.id=p_order_id and o.venue_id=p_venue_id;

  return jsonb_build_object('ok',true,'order_id',p_order_id,'status',v_status,'order',v_row);
end;
$$;

revoke all on function public.manager_update_order(uuid, uuid, text) from public;
grant execute on function public.manager_update_order(uuid, uuid, text) to authenticated;

commit;
