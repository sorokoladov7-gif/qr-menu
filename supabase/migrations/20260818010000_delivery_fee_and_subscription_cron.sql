-- Per-venue delivery fee and automatic subscription expiry.
-- Keeps the current default business rule at 150 RUB while allowing each venue to override it.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2) NOT NULL DEFAULT 150;

UPDATE public.venues
SET delivery_fee = 150
WHERE delivery_fee IS NULL;

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_venue_id uuid,
  p_order_type text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_comment text,
  p_payment_method text,
  p_items jsonb,
  p_addons jsonb,
  p_total_price numeric,
  p_table_token text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order public.orders;
  v_item jsonb;
  v_addon jsonb;
  v_product public.products;
  v_table public.venue_tables;
  v_session public.table_sessions;
  v_qty integer;
  v_delivery_fee numeric := 0;
  v_base_total numeric := 0;
  v_addon_total numeric := 0;
  v_expected_total numeric := 0;
begin
  if not exists(select 1 from public.venues where id=p_venue_id and status='active') then raise exception 'venue_not_found'; end if;
  if p_order_type not in ('pickup','delivery') then raise exception 'invalid_order_type'; end if;
  if nullif(trim(p_customer_phone),'') is null then raise exception 'customer_phone_required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'order_items_required'; end if;
  if p_order_type='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'delivery_address_required'; end if;

  if p_order_type='delivery' then
    select coalesce(delivery_fee,150) into v_delivery_fee
    from public.venues
    where id=p_venue_id;
  end if;

  if nullif(trim(p_table_token),'') is not null then
    select * into v_table from public.venue_tables
    where venue_id=p_venue_id and qr_token=trim(p_table_token) and is_active=true
    limit 1 for update;
    if v_table.id is null then raise exception 'table_not_found'; end if;
    if v_table.current_session_id is not null then
      select * into v_session from public.table_sessions
      where id=v_table.current_session_id and status='active' for update;
    end if;
    if v_session.id is null then
      insert into public.table_sessions(venue_id,table_id,status)
      values(p_venue_id,v_table.id,'active') returning * into v_session;
      update public.venue_tables
      set occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=v_session.id
      where id=v_table.id;
    end if;
  end if;

  insert into public.orders(
    venue_id,table_id,table_session_id,status,order_type,customer_name,customer_phone,
    delivery_address,comment,payment_method,items,addons,total_price
  ) values(
    p_venue_id,v_table.id,v_session.id,'new',p_order_type,nullif(trim(p_customer_name),''),trim(p_customer_phone),
    nullif(trim(p_delivery_address),''),nullif(trim(p_comment),''),coalesce(nullif(trim(p_payment_method),''),'cash'),
    '[]'::jsonb,coalesce(p_addons,'[]'::jsonb),0
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_qty:=coalesce((v_item->>'qty')::integer,0);
    if v_qty<1 or v_qty>99 then raise exception 'invalid_item_quantity'; end if;
    select * into v_product from public.products
    where id=(v_item->>'product_id')::uuid and venue_id=p_venue_id and is_available=true and category<>'addon'
    limit 1;
    if v_product.id is null then raise exception 'product_not_available'; end if;
    v_base_total:=v_base_total+(v_product.price*v_qty);
    insert into public.order_items(order_id,product_id,name,price,qty)
    values(v_order.id,v_product.id,v_product.name,v_product.price,v_qty);
  end loop;

  if p_addons is not null and jsonb_typeof(p_addons)='array' then
    for v_addon in select value from jsonb_array_elements(p_addons) loop
      v_qty:=coalesce((v_addon->>'qty')::integer,0);
      if v_qty<1 or v_qty>99 then raise exception 'invalid_addon_quantity'; end if;
      select * into v_product from public.products
      where id=(v_addon->>'id')::uuid and venue_id=p_venue_id and is_available=true and category='addon'
      limit 1;
      if v_product.id is null then raise exception 'addon_not_available'; end if;
      v_addon_total:=v_addon_total+(v_product.price*v_qty);
      for i in 1..v_qty loop
        insert into public.order_addons(order_id,name,price,item_name)
        values(v_order.id,v_product.name,v_product.price,nullif(v_addon->>'item_name',''));
      end loop;
    end loop;
  end if;

  v_expected_total:=v_base_total+v_addon_total+v_delivery_fee;
  if p_total_price is null or abs(p_total_price-v_expected_total)>0.01 then raise exception 'invalid_total_price'; end if;

  update public.orders
  set total_price=v_expected_total,items=p_items,addons=coalesce(p_addons,'[]'::jsonb)
  where id=v_order.id;

  if v_session.id is not null then
    update public.table_sessions
    set started_order_id=coalesce(started_order_id,v_order.id),last_order_id=v_order.id
    where id=v_session.id;
  end if;

  return jsonb_build_object(
    'id',v_order.id,'order_number',v_order.order_number,'venue_id',v_order.venue_id,'table_id',v_order.table_id,
    'table_session_id',v_order.table_session_id,'status',v_order.status,'order_type',v_order.order_type,
    'customer_name',v_order.customer_name,'customer_phone',v_order.customer_phone,'delivery_address',v_order.delivery_address,
    'comment',v_order.comment,'payment_method',v_order.payment_method,'items',p_items,'addons',coalesce(p_addons,'[]'::jsonb),
    'delivery_fee',v_delivery_fee,'total_price',v_expected_total,'created_at',v_order.created_at
  );
end $function$;

GRANT EXECUTE ON FUNCTION public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text) TO anon,authenticated;

-- Run subscription expiry automatically. pg_cron is available in Supabase projects.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $$
DECLARE job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname='check-subscription-expiry';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
  PERFORM cron.schedule(
    'check-subscription-expiry',
    '*/15 * * * *',
    $$SELECT public.check_subscription_expiry();$$
  );
END;
$$;
