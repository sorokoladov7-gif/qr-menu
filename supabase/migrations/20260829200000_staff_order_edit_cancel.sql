-- Staff order editing and cancellation for waiter/cook.
-- Editing is limited to active kitchen orders; the RPC validates the staff token and venue.

create or replace function public.staff_edit_order(
  p_token text,
  p_order_id uuid,
  p_items jsonb,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  s public.staff_sessions;
  o public.orders%rowtype;
  v_items jsonb;
  v_addons jsonb;
  v_total numeric := 0;
  v_delivery_fee numeric := coalesce(o.delivery_fee, 0);
  v_old_status text;
  v_new_status text;
  v_staff_name text;
  v_actor_type text;
  v_history_id uuid;
  v_bad_count integer;
begin
  select * into s
  from public.staff_sessions
  where token = p_token and expires_at > now()
  limit 1;

  if s.id is null then
    return jsonb_build_object('error','invalid_session');
  end if;

  if s.staff_type not in ('waiter','cook') then
    return jsonb_build_object('error','staff_type_not_allowed');
  end if;

  select * into o
  from public.orders
  where id = p_order_id and venue_id = s.venue_id
  for update;

  if o.id is null then
    return jsonb_build_object('error','order_not_found');
  end if;

  if o.status not in ('new','changed','cooking') then
    return jsonb_build_object('error','order_edit_not_allowed','status',o.status);
  end if;

  if jsonb_typeof(coalesce(p_items,'null'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    return jsonb_build_object('error','items_required');
  end if;

  with raw as (
    select
      nullif(trim(x->>'product_id'),'')::uuid as product_id,
      greatest(coalesce((x->>'qty')::integer, 0), 0) as qty
    from jsonb_array_elements(p_items) x
  ), grouped as (
    select product_id, sum(qty)::integer as qty
    from raw
    group by product_id
  )
  select count(*) filter (where product_id is null or qty < 1 or qty > 99)
  into v_bad_count
  from grouped;

  if coalesce(v_bad_count,0) > 0 then
    return jsonb_build_object('error','invalid_items');
  end if;

  -- Every product must belong to this venue. New products must currently be available.
  if exists (
    with requested as (
      select distinct nullif(trim(x->>'product_id'),'')::uuid as product_id
      from jsonb_array_elements(p_items) x
    )
    select 1
    from requested r
    left join public.products p on p.id = r.product_id
    where p.id is null
       or p.venue_id <> s.venue_id
       or (p.is_available is false and not exists (
         select 1
         from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) old_item
         where nullif(trim(old_item->>'product_id'),'')::uuid = r.product_id
       ))
  ) then
    return jsonb_build_object('error','product_not_available');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'product_id', g.product_id,
      'qty', g.qty,
      'name', p.name,
      'price', p.price
    ) order by p.name
  ), '[]'::jsonb),
  coalesce(sum(p.price * g.qty),0)
  into v_items, v_total
  from (
    select nullif(trim(x->>'product_id'),'')::uuid as product_id,
           sum(greatest(coalesce((x->>'qty')::integer,0),0))::integer as qty
    from jsonb_array_elements(p_items) x
    group by nullif(trim(x->>'product_id'),'')::uuid
  ) g
  join public.products p on p.id = g.product_id and p.venue_id = s.venue_id;

  v_addons := coalesce(o.addons,'[]'::jsonb);
  v_total := v_total + coalesce((
    select sum(
      coalesce(p.price, nullif(a->>'price','')::numeric, 0)
      * greatest(coalesce((a->>'qty')::integer,1),1)
    )
    from jsonb_array_elements(v_addons) a
    left join public.products p on p.id = nullif(trim(a->>'id'),'')::uuid
  ),0) + v_delivery_fee;

  v_old_status := o.status;
  if s.staff_type = 'waiter' then
    v_new_status := 'changed';
    v_actor_type := 'waiter';
    select name into v_staff_name from public.waiters where id=s.staff_id;
  else
    v_new_status := case when o.status='cooking' then 'cooking' else 'changed' end;
    v_actor_type := 'cook';
    select name into v_staff_name from public.cooks where id=s.staff_id;
  end if;
  v_staff_name := coalesce(nullif(trim(v_staff_name),''), v_actor_type);

  update public.orders
  set items = v_items,
      addons = v_addons,
      total_price = v_total,
      comment = case when p_comment is null then comment else p_comment end,
      status = v_new_status,
      updated_at = now(),
      waiter_name = case when s.staff_type='waiter' then v_staff_name else waiter_name end,
      cook_name = case when s.staff_type='cook' then v_staff_name else cook_name end
  where id=o.id;

  if v_old_status <> v_new_status then
    select id into v_history_id
    from public.order_status_history
    where order_id=o.id and venue_id=o.venue_id
      and old_status=v_old_status and new_status=v_new_status
    order by created_at desc, id desc
    limit 1;

    if v_history_id is not null then
      update public.order_status_history
      set actor_type=v_actor_type, actor_id=s.staff_id, actor_name=v_staff_name
      where id=v_history_id;
    end if;
  end if;

  return jsonb_build_object(
    'success',true,
    'order_id',o.id,
    'old_status',v_old_status,
    'new_status',v_new_status,
    'items',v_items,
    'total_price',v_total
  );
end;
$function$;

create or replace function public.staff_cancel_order(
  p_token text,
  p_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  s public.staff_sessions;
  o public.orders%rowtype;
  v_staff_name text;
  v_actor_type text;
  v_history_id uuid;
  v_old_status text;
  v_comment text;
begin
  select * into s
  from public.staff_sessions
  where token = p_token and expires_at > now()
  limit 1;

  if s.id is null then
    return jsonb_build_object('error','invalid_session');
  end if;

  if s.staff_type not in ('waiter','cook') then
    return jsonb_build_object('error','staff_type_not_allowed');
  end if;

  select * into o
  from public.orders
  where id=p_order_id and venue_id=s.venue_id
  for update;

  if o.id is null then
    return jsonb_build_object('error','order_not_found');
  end if;

  if o.status not in ('new','changed','cooking') then
    return jsonb_build_object('error','order_cancel_not_allowed','status',o.status);
  end if;

  v_old_status := o.status;
  v_actor_type := s.staff_type;
  if s.staff_type='waiter' then
    select name into v_staff_name from public.waiters where id=s.staff_id;
  else
    select name into v_staff_name from public.cooks where id=s.staff_id;
  end if;
  v_staff_name := coalesce(nullif(trim(v_staff_name),''),v_actor_type);
  v_comment := nullif(trim(coalesce(p_reason,'')),'');

  update public.orders
  set status='cancelled',
      updated_at=now(),
      comment=case
        when v_comment is null then comment
        when nullif(trim(coalesce(comment,'')),'') is null then 'Отменён: '||v_comment
        else comment||E'\nОтменён: '||v_comment
      end,
      waiter_name=case when s.staff_type='waiter' then v_staff_name else waiter_name end,
      cook_name=case when s.staff_type='cook' then v_staff_name else cook_name end
  where id=o.id;

  select id into v_history_id
  from public.order_status_history
  where order_id=o.id and venue_id=o.venue_id
    and old_status=v_old_status and new_status='cancelled'
  order by created_at desc, id desc
  limit 1;

  if v_history_id is not null then
    update public.order_status_history
    set actor_type=v_actor_type, actor_id=s.staff_id, actor_name=v_staff_name
    where id=v_history_id;
  end if;

  return jsonb_build_object('success',true,'order_id',o.id,'old_status',v_old_status,'new_status','cancelled');
end;
$function$;

revoke all on function public.staff_edit_order(text,uuid,jsonb,text) from public;
revoke all on function public.staff_cancel_order(text,uuid,text) from public;
grant execute on function public.staff_edit_order(text,uuid,jsonb,text) to anon, authenticated;
grant execute on function public.staff_cancel_order(text,uuid,text) to anon, authenticated;
