-- Harden the active staff order reader/editor and waiter compatibility wrapper.
-- Staff PWAs authenticate with staff_sessions tokens, so every privileged path
-- must enforce token expiry and venue scope at the database boundary.

CREATE OR REPLACE FUNCTION public.staff_edit_order(
  p_token text,
  p_order_id uuid,
  p_items jsonb,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  s public.staff_sessions;
  o public.orders%rowtype;
  v_items jsonb;
  v_addons jsonb;
  v_total numeric := 0;
  v_delivery_fee numeric := 0;
  v_old_status text;
  v_new_status text;
  v_staff_name text;
  v_actor_type text;
  v_history_id uuid;
  v_bad_count integer;
begin
  select * into s
  from public.staff_sessions
  where token=p_token
    and expires_at>now()
  limit 1;

  if s.id is null then
    return jsonb_build_object('error','invalid_session');
  end if;
  if s.staff_type not in ('waiter','cook') then
    return jsonb_build_object('error','staff_type_not_allowed');
  end if;

  select * into o
  from public.orders
  where id=p_order_id
    and venue_id=s.venue_id
  for update;

  if o.id is null then
    return jsonb_build_object('error','order_not_found');
  end if;
  if o.status not in ('new','changed','cooking') then
    return jsonb_build_object('error','order_edit_not_allowed','status',o.status);
  end if;
  if jsonb_typeof(coalesce(p_items,'null'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_items,'[]'::jsonb))=0 then
    return jsonb_build_object('error','items_required');
  end if;

  with raw as (
    select nullif(trim(x->>'product_id'),'')::uuid product_id,
           greatest(coalesce((x->>'qty')::integer,0),0) qty
    from jsonb_array_elements(p_items) x
  ), grouped as (
    select product_id,sum(qty)::integer qty
    from raw group by product_id
  )
  select count(*) filter (where product_id is null or qty<1 or qty>99)
  into v_bad_count
  from grouped;

  if coalesce(v_bad_count,0)>0 then
    return jsonb_build_object('error','invalid_items');
  end if;

  if exists (
    with requested as (
      select distinct nullif(trim(x->>'product_id'),'')::uuid product_id
      from jsonb_array_elements(p_items) x
    )
    select 1
    from requested r
    left join public.products p on p.id=r.product_id
    where p.id is null
      or p.venue_id<>s.venue_id
      or (p.is_available is false and not exists (
        select 1
        from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) old_item
        where nullif(trim(old_item->>'product_id'),'')::uuid=r.product_id
      ))
  ) then
    return jsonb_build_object('error','product_not_available');
  end if;

  select
    coalesce(jsonb_agg(
      jsonb_build_object('product_id',g.product_id,'qty',g.qty,'name',p.name,'price',p.price)
      order by p.name
    ),'[]'::jsonb),
    coalesce(sum(p.price*g.qty),0)
  into v_items,v_total
  from (
    select nullif(trim(x->>'product_id'),'')::uuid product_id,
           sum(greatest(coalesce((x->>'qty')::integer,0),0))::integer qty
    from jsonb_array_elements(p_items) x
    group by nullif(trim(x->>'product_id'),'')::uuid
  ) g
  join public.products p on p.id=g.product_id and p.venue_id=s.venue_id;

  v_addons:=coalesce(o.addons,'[]'::jsonb);
  v_delivery_fee:=coalesce(o.delivery_fee,0);
  v_total:=v_total+
    coalesce((
      select sum(
        coalesce(p.price,nullif(a->>'price','')::numeric,0)
        * greatest(coalesce((a->>'qty')::integer,1),1)
      )
      from jsonb_array_elements(v_addons) a
      left join public.products p
        on p.id=nullif(trim(a->>'id'),'')::uuid
       and p.venue_id=s.venue_id
    ),0)+v_delivery_fee;

  v_old_status:=o.status;
  if s.staff_type='waiter' then
    v_new_status:='changed';
    v_actor_type:='waiter';
    select name into v_staff_name from public.waiters where id=s.staff_id;
  else
    v_new_status:=case when o.status='cooking' then 'cooking' else 'changed' end;
    v_actor_type:='cook';
    select name into v_staff_name from public.cooks where id=s.staff_id;
  end if;
  v_staff_name:=coalesce(nullif(trim(v_staff_name),''),v_actor_type);

  update public.orders
  set items=v_items,
      addons=v_addons,
      total_price=v_total,
      comment=case when p_comment is null then comment else p_comment end,
      status=v_new_status,
      updated_at=now(),
      waiter_name=case when s.staff_type='waiter' then v_staff_name else waiter_name end,
      cook_name=case when s.staff_type='cook' then v_staff_name else cook_name end
  where id=o.id;

  if v_old_status<>v_new_status then
    select id into v_history_id
    from public.order_status_history
    where order_id=o.id
      and venue_id=o.venue_id
      and old_status=v_old_status
      and new_status=v_new_status
    order by created_at desc,id desc
    limit 1;
    if v_history_id is not null then
      update public.order_status_history
      set actor_type=v_actor_type,actor_id=s.staff_id,actor_name=v_staff_name
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

CREATE OR REPLACE FUNCTION public.staff_orders_json(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.staff_sessions;
  v_orders jsonb;
BEGIN
  SELECT * INTO s
  FROM public.staff_sessions
  WHERE token=p_token AND expires_at>now()
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('error','invalid_session');
  END IF;

  SELECT jsonb_agg(o_row ORDER BY o_row.created_at DESC)
  INTO v_orders
  FROM (
    SELECT
      o.*,
      COALESCE((
        SELECT jsonb_agg(
          item || jsonb_build_object(
            'name', COALESCE(p.name, item->>'name', 'Дополнение'),
            'price', COALESCE(p.price, (item->>'price')::numeric, 0)
          )
        )
        FROM jsonb_array_elements(COALESCE(o.items,'[]'::jsonb)) item
        LEFT JOIN public.products p
          ON p.id=(item->>'product_id')::uuid
         AND p.venue_id=s.venue_id
      ),'[]'::jsonb) AS items,
      COALESCE((
        SELECT jsonb_agg(
          addon || jsonb_build_object(
            'name', COALESCE(p.name, addon->>'name', 'Дополнение'),
            'price', COALESCE(p.price, (addon->>'price')::numeric, 0),
            'qty', GREATEST(COALESCE((addon->>'qty')::integer,1),1)
          )
        )
        FROM jsonb_array_elements(COALESCE(o.addons,'[]'::jsonb)) addon
        LEFT JOIN public.products p
          ON p.id=(addon->>'id')::uuid
         AND p.venue_id=s.venue_id
      ),'[]'::jsonb) AS addons
    FROM public.orders o
    WHERE o.venue_id=s.venue_id
      AND (
        (s.staff_type='cook' AND o.status IN ('new','changed','cooking','ready','delivery'))
        OR
        (s.staff_type='courier' AND o.status IN ('ready','delivery','arrived') AND o.order_type='delivery')
        OR
        (s.staff_type='courier' AND o.order_type='delivery' AND EXISTS (
          SELECT 1 FROM public.order_status_history h
          WHERE h.order_id=o.id
            AND h.venue_id=o.venue_id
            AND h.actor_type='courier'
            AND h.actor_id=s.staff_id
            AND h.new_status='done'
        ))
        OR
        (s.staff_type='waiter' AND o.status IN ('new','changed','cooking','ready','delivery')
         AND (o.order_type<>'delivery' OR o.order_type IS NULL))
      )
    ORDER BY o.created_at DESC
  ) o_row;

  RETURN COALESCE(v_orders,'[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.waiter_release_table(p_token text, p_table_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE s public.staff_sessions;
BEGIN
  SELECT * INTO s
  FROM public.staff_sessions
  WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL OR s.staff_type<>'waiter' THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;
  RETURN public.staff_close_table_session(p_token,p_table_id);
END;
$function$;
