create or replace function public.create_public_order(
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
  p_table_token text default null,
  p_delivery_fee numeric default 0
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_addon jsonb;
  v_product public.products%rowtype;
  v_table public.venue_tables%rowtype;
  v_session public.table_sessions%rowtype;
  v_qty integer;
  v_base_total numeric := 0;
  v_addon_total numeric := 0;
  v_expected_total numeric := 0;
  v_venue public.venues%rowtype;
  v_delivery_fee numeric := 0;
begin
  select * into v_venue from public.venues where id=p_venue_id and status='active';
  if not found then raise exception 'venue_not_found'; end if;
  if p_order_type not in ('pickup','table','delivery') then raise exception 'invalid_order_type'; end if;
  if nullif(trim(p_customer_phone),'') is null then raise exception 'customer_phone_required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'order_items_required'; end if;
  if p_order_type='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'delivery_address_required'; end if;

  -- Validate canonical menu prices for every order type.
  for v_item in select value from jsonb_array_elements(p_items) loop
    begin v_qty := (v_item->>'qty')::integer; exception when invalid_text_representation then raise exception 'invalid_item_quantity'; end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'invalid_item_quantity'; end if;
    select * into v_product from public.products
     where id=(v_item->>'product_id')::uuid and venue_id=p_venue_id
       and coalesce(is_available,true)=true and coalesce(category,'main')<>'addon' limit 1;
    if v_product.id is null then raise exception 'product_not_available'; end if;
    v_base_total := v_base_total + v_product.price * v_qty;
  end loop;

  if p_addons is not null and jsonb_typeof(p_addons)='array' then
    for v_addon in select value from jsonb_array_elements(p_addons) loop
      begin v_qty := (v_addon->>'qty')::integer; exception when invalid_text_representation then raise exception 'invalid_addon_quantity'; end;
      if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'invalid_addon_quantity'; end if;
      select * into v_product from public.products
       where id=(v_addon->>'id')::uuid and venue_id=p_venue_id
         and coalesce(is_available,true)=true and category='addon' limit 1;
      if v_product.id is null then raise exception 'addon_not_available'; end if;
      v_addon_total := v_addon_total + v_product.price * v_qty;
    end loop;
  end if;

  v_expected_total := v_base_total + v_addon_total;
  if p_order_type='delivery' then
    if coalesce(v_venue.delivery_min_order,0)>0 and v_expected_total < v_venue.delivery_min_order then
      raise exception 'delivery_min_order_not_reached' using detail=v_venue.delivery_min_order::text;
    end if;
    if coalesce(v_venue.delivery_min_order_free,0)>0 and v_expected_total >= v_venue.delivery_min_order_free then
      v_delivery_fee := 0;
    else
      v_delivery_fee := greatest(coalesce(p_delivery_fee,0),0);
    end if;
    v_expected_total := v_expected_total + v_delivery_fee;
  end if;
  if abs(coalesce(p_total_price,0)-v_expected_total)>0.01 then raise exception 'invalid_total_price'; end if;

  if p_order_type='table' then
    if nullif(trim(p_table_token),'') is null then raise exception 'table_token_required'; end if;
    select * into v_table from public.venue_tables
     where venue_id=p_venue_id and qr_token=trim(p_table_token) and is_active=true limit 1 for update;
    if not found then raise exception 'table_not_found'; end if;
    if v_table.occupancy_status='reserved' and v_table.current_session_id is null then raise exception 'table_reserved'; end if;
    if v_table.current_session_id is null or v_table.occupancy_status<>'occupied' then
      insert into public.table_sessions(venue_id,table_id,status,opened_by_type,opened_by_name,guest_count)
      values(p_venue_id,v_table.id,'active','customer','QR',1) returning * into v_session;
      update public.venue_tables set occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=v_session.id,guest_count=greatest(coalesce(guest_count,0),1) where id=v_table.id;
    else
      select * into v_session from public.table_sessions
       where id=v_table.current_session_id and venue_id=p_venue_id and table_id=v_table.id and status='active' for update;
      if v_session.id is null then raise exception 'table_session_not_found'; end if;
    end if;
  end if;

  insert into public.orders(venue_id,table_id,table_session_id,status,order_type,customer_name,customer_phone,delivery_address,comment,payment_method,items,addons,total_price,delivery_fee,created_at)
  values(p_venue_id,v_table.id,v_session.id,'new',p_order_type,nullif(trim(p_customer_name),''),trim(p_customer_phone),nullif(trim(p_delivery_address),''),nullif(trim(p_comment),''),coalesce(nullif(trim(p_payment_method),''),'cash'),p_items,coalesce(p_addons,'[]'::jsonb),v_expected_total,v_delivery_fee,now()) returning * into v_order;

  if v_session.id is not null then
    update public.table_sessions set last_order_id=v_order.id,started_order_id=coalesce(started_order_id,v_order.id),guest_count=greatest(coalesce(guest_count,0),1) where id=v_session.id;
  end if;

  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'venue_id',v_order.venue_id,'table_id',v_order.table_id,'table_session_id',v_order.table_session_id,'status',v_order.status,'order_type',v_order.order_type,'customer_name',v_order.customer_name,'customer_phone',v_order.customer_phone,'delivery_address',v_order.delivery_address,'comment',v_order.comment,'payment_method',v_order.payment_method,'items',p_items,'addons',coalesce(p_addons,'[]'::jsonb),'delivery_fee',v_delivery_fee,'total_price',v_expected_total,'created_at',v_order.created_at);
end;
$function$;

revoke execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric) from public;
grant execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric) to anon, authenticated;
