begin;

alter table public.venues add column if not exists delivery_min_order numeric not null default 0;
alter table public.venues drop constraint if exists venues_delivery_min_order_nonnegative;
alter table public.venues add constraint venues_delivery_min_order_nonnegative check (delivery_min_order >= 0);

create or replace function public.guard_venue_permission()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if is_admin() then return new; end if;
  if not is_manager_of(new.id) then raise exception 'not_authorized'; end if;
  if new.name is distinct from old.name or new.description is distinct from old.description or new.address is distinct from old.address then
    if not public.manager_has_permission(new.id,'edit_venue') then raise exception 'venue_permission_required'; end if;
  end if;
  if new.logo_url is distinct from old.logo_url or new.brand_color is distinct from old.brand_color then
    if not public.manager_has_permission(new.id,'edit_branding') then raise exception 'branding_permission_required'; end if;
  end if;
  if new.design_settings is distinct from old.design_settings then
    if not public.manager_has_permission(new.id,'edit_design') then raise exception 'design_permission_required'; end if;
  end if;
  if new.delivery_fee is distinct from old.delivery_fee or new.delivery_base_price is distinct from old.delivery_base_price or new.delivery_per_km is distinct from old.delivery_per_km or new.delivery_max_km is distinct from old.delivery_max_km or new.delivery_rate_per_km is distinct from old.delivery_rate_per_km or new.delivery_min_order_free is distinct from old.delivery_min_order_free or new.delivery_min_order is distinct from old.delivery_min_order or new.delivery_base_fee is distinct from old.delivery_base_fee or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    if not public.manager_has_permission(new.id,'edit_delivery') then raise exception 'delivery_permission_required'; end if;
  end if;
  return new;
end;
$function$;

create or replace function public.calc_delivery_fee(p_venue_id uuid,p_lat double precision,p_lng double precision)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v public.venues; v_lat double precision; v_lng double precision; dist_km numeric; fee numeric; r constant numeric:=6371; dlat numeric; dlng numeric; a numeric; c numeric;
begin
  select * into v from public.venues where id=p_venue_id;
  if v.id is null then raise exception 'venue_not_found'; end if;
  v_lat:=coalesce(v.latitude,v.lat::double precision); v_lng:=coalesce(v.longitude,v.lng::double precision);
  if v_lat is null or v_lng is null then return jsonb_build_object('distance_km',0,'fee',coalesce(v.delivery_base_price,v.delivery_base_fee,v.delivery_fee,150),'ok',true,'coordinates_available',false); end if;
  if p_lat is null or p_lng is null then raise exception 'customer_coordinates_required'; end if;
  dlat:=radians(p_lat-v_lat); dlng:=radians(p_lng-v_lng); a:=sin(dlat/2)^2+cos(radians(v_lat))*cos(radians(p_lat))*sin(dlng/2)^2; c:=2*atan2(sqrt(a),sqrt(1-a)); dist_km:=round((r*c)::numeric,2);
  if v.delivery_max_km is not null and dist_km>v.delivery_max_km then return jsonb_build_object('ok',false,'error','too_far','distance_km',dist_km); end if;
  fee:=coalesce(v.delivery_base_price,v.delivery_base_fee,v.delivery_fee,100)+coalesce(v.delivery_per_km,v.delivery_rate_per_km,30)*dist_km;
  return jsonb_build_object('ok',true,'distance_km',dist_km,'fee',round(fee,0),'coordinates_available',true);
end;
$function$;

drop function if exists public.public_venue_by_slug(text);
create function public.public_venue_by_slug(p_slug text)
returns table(id uuid,name text,slug text,description text,logo_url text,brand_color text,status text,address text,lat numeric,lng numeric,latitude double precision,longitude double precision,delivery_base_price numeric,delivery_per_km numeric,delivery_max_km numeric,delivery_rate_per_km numeric,delivery_min_order numeric,delivery_min_order_free numeric,delivery_base_fee numeric)
language sql stable security definer set search_path to 'public' as $function$
  select v.id,v.name,v.slug,v.description,v.logo_url,v.brand_color,v.status,v.address,v.lat,v.lng,v.latitude,v.longitude,v.delivery_base_price,v.delivery_per_km,v.delivery_max_km,v.delivery_rate_per_km,v.delivery_min_order,v.delivery_min_order_free,v.delivery_base_fee
  from public.venues v where v.slug=lower(trim(p_slug)) limit 1;
$function$;
grant execute on function public.public_venue_by_slug(text) to anon, authenticated, service_role;

create or replace function public.create_public_order(p_venue_id uuid,p_order_type text,p_customer_name text,p_customer_phone text,p_delivery_address text,p_comment text,p_payment_method text,p_items jsonb,p_addons jsonb,p_total_price numeric,p_table_token text default null,p_delivery_fee numeric default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_order orders%rowtype; v_item jsonb; v_addon jsonb; v_product products%rowtype; v_table venue_tables%rowtype; v_session table_sessions%rowtype; v_qty integer; v_base_total numeric:=0; v_addon_total numeric:=0; v_expected_total numeric:=0; v_venue venues%rowtype; v_delivery_fee numeric:=0;
begin
  select * into v_venue from venues where id=p_venue_id and status='active'; if not found then raise exception 'venue_not_found'; end if;
  if p_order_type not in ('pickup','table','delivery') then raise exception 'invalid_order_type'; end if;
  if nullif(trim(p_customer_phone),'') is null then raise exception 'customer_phone_required'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'order_items_required'; end if;
  if p_order_type='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'delivery_address_required'; end if;
  if p_order_type='table' then
    if nullif(trim(p_table_token),'') is null then raise exception 'table_token_required'; end if;
    select * into v_table from venue_tables where venue_id=p_venue_id and qr_token=trim(p_table_token) and is_active=true limit 1 for update;
    if not found then raise exception 'table_not_found'; end if;
    if v_table.occupancy_status='reserved' and v_table.current_session_id is null then raise exception 'table_reserved'; end if;
    if v_table.current_session_id is null or v_table.occupancy_status<>'occupied' then
      insert into table_sessions(venue_id,table_id,status,opened_by_type,opened_by_name,guest_count) values(p_venue_id,v_table.id,'active','customer','QR',1) returning * into v_session;
      update venue_tables set occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=v_session.id where id=v_table.id;
    else
      select * into v_session from table_sessions where id=v_table.current_session_id and status='active' for update;
      if v_session.id is null then raise exception 'table_session_not_found'; end if;
    end if;
  end if;
  if p_order_type='delivery' then
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_qty:=(v_item->>'qty')::integer; if v_qty<1 or v_qty>99 then raise exception 'invalid_item_quantity'; end if;
      select * into v_product from products where id=(v_item->>'product_id')::uuid and venue_id=p_venue_id and is_available=true and category<>'addon' limit 1;
      if not found then raise exception 'product_not_available'; end if; v_base_total:=v_base_total+v_product.price*v_qty;
    end loop;
    if p_addons is not null and jsonb_typeof(p_addons)='array' then
      for v_addon in select * from jsonb_array_elements(p_addons) loop
        v_qty:=(v_addon->>'qty')::integer; if v_qty<1 or v_qty>99 then raise exception 'invalid_addon_quantity'; end if;
        select * into v_product from products where id=(v_addon->>'id')::uuid and venue_id=p_venue_id and is_available=true and category='addon' limit 1;
        if not found then raise exception 'addon_not_available'; end if; v_addon_total:=v_addon_total+v_product.price*v_qty;
      end loop;
    end if;
    v_expected_total:=v_base_total+v_addon_total;
    if coalesce(v_venue.delivery_min_order,0)>0 and v_expected_total<v_venue.delivery_min_order then raise exception 'delivery_min_order_not_reached' using detail=v_venue.delivery_min_order::text; end if;
    if coalesce(v_venue.delivery_min_order_free,0)>0 and v_expected_total>=v_venue.delivery_min_order_free then v_delivery_fee:=0; else v_delivery_fee:=greatest(coalesce(p_delivery_fee,0),0); end if;
    v_expected_total:=v_expected_total+v_delivery_fee;
  else v_delivery_fee:=0; v_expected_total:=p_total_price; end if;
  if abs(p_total_price-v_expected_total)>0.01 then raise exception 'invalid_total_price'; end if;
  insert into orders(venue_id,table_id,table_session_id,status,order_type,customer_name,customer_phone,delivery_address,comment,payment_method,items,addons,total_price,delivery_fee,created_at) values(p_venue_id,v_table.id,v_session.id,'new',p_order_type,nullif(trim(p_customer_name),''),trim(p_customer_phone),nullif(trim(p_delivery_address),''),nullif(trim(p_comment),''),coalesce(nullif(trim(p_payment_method),''),'cash'),p_items,coalesce(p_addons,'[]'::jsonb),v_expected_total,v_delivery_fee,now()) returning * into v_order;
  if v_session.id is not null then update table_sessions set last_order_id=v_order.id,started_order_id=coalesce(started_order_id,v_order.id),guest_count=greatest(coalesce(guest_count,0),1) where id=v_session.id; end if;
  return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'venue_id',v_order.venue_id,'table_id',v_order.table_id,'table_session_id',v_order.table_session_id,'status',v_order.status,'order_type',v_order.order_type,'customer_name',v_order.customer_name,'customer_phone',v_order.customer_phone,'delivery_address',v_order.delivery_address,'comment',v_order.comment,'payment_method',v_order.payment_method,'items',p_items,'addons',coalesce(p_addons,'[]'::jsonb),'delivery_fee',v_delivery_fee,'total_price',v_expected_total,'created_at',v_order.created_at);
end;
$function$;

commit;
