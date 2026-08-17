-- Table Session 2.0: one active guest session per table, explicit close,
-- QR orders attached to the active session, and role-aware staff control.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS table_session_id uuid REFERENCES public.table_sessions(id);

CREATE INDEX IF NOT EXISTS orders_table_session_id_idx
  ON public.orders(table_session_id);

CREATE OR REPLACE FUNCTION public.staff_can_control_tables(p_staff_type text, p_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p_staff_type = 'waiter'
      OR (p_staff_type = 'cook' AND NOT EXISTS (
          SELECT 1 FROM public.waiters w WHERE w.venue_id = p_venue_id
      ));
$$;

CREATE OR REPLACE FUNCTION public.staff_table_board(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; result jsonb;
BEGIN
  SELECT * INTO s FROM public.staff_sessions
  WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN
    RAISE EXCEPTION 'table_control_requires_waiter';
  END IF;
  SELECT coalesce(jsonb_agg(x ORDER BY x.table_number), '[]'::jsonb) INTO result
  FROM (
    SELECT t.id,t.table_number,t.name,t.seats,t.shape,t.occupancy_status,t.occupied_since,t.current_session_id,
      ts.started_at session_started_at,ts.last_order_id,
      coalesce((SELECT count(*) FROM public.orders o WHERE o.table_session_id=ts.id),0) order_count,
      coalesce((SELECT sum(o.total_price) FROM public.orders o WHERE o.table_session_id=ts.id AND o.status<>'cancelled'),0) total_amount,
      coalesce((SELECT count(*) FROM public.orders o WHERE o.table_session_id=ts.id AND o.status IN ('new','cooking','ready','delivery','changed')),0) open_order_count
    FROM public.venue_tables t
    LEFT JOIN public.table_sessions ts ON ts.id=t.current_session_id AND ts.status='active'
    WHERE t.venue_id=s.venue_id AND t.is_active=true
  ) x;
  RETURN jsonb_build_object('ok',true,'venue_id',s.venue_id,'staff_type',s.staff_type,'can_control',true,'tables',result);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_start_table_session(p_token text,p_table_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; t public.venue_tables%rowtype; sess public.table_sessions%rowtype;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF t.current_session_id IS NOT NULL AND t.occupancy_status='occupied' THEN
    SELECT * INTO sess FROM public.table_sessions WHERE id=t.current_session_id AND status='active' FOR UPDATE;
    IF sess.id IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'already_active',true,'session_id',sess.id,'table_id',t.id); END IF;
  END IF;
  INSERT INTO public.table_sessions(venue_id,table_id,status) VALUES(s.venue_id,t.id,'active') RETURNING * INTO sess;
  UPDATE public.venue_tables SET occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=sess.id WHERE id=t.id;
  RETURN jsonb_build_object('ok',true,'already_active',false,'session_id',sess.id,'table_id',t.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_close_table_session(p_token text,p_table_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; t public.venue_tables%rowtype; sess public.table_sessions%rowtype; open_count integer;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF t.current_session_id IS NULL THEN
    UPDATE public.venue_tables SET occupancy_status='free',occupied_since=NULL,current_session_id=NULL WHERE id=t.id;
    RETURN jsonb_build_object('ok',true,'already_free',true,'table_id',t.id);
  END IF;
  SELECT * INTO sess FROM public.table_sessions WHERE id=t.current_session_id AND status='active' FOR UPDATE;
  IF sess.id IS NULL THEN
    UPDATE public.venue_tables SET occupancy_status='free',occupied_since=NULL,current_session_id=NULL WHERE id=t.id;
    RETURN jsonb_build_object('ok',true,'already_free',true,'table_id',t.id);
  END IF;
  SELECT count(*) INTO open_count FROM public.orders WHERE table_session_id=sess.id AND status IN ('new','cooking','ready','delivery','changed');
  IF open_count>0 THEN RAISE EXCEPTION 'table_has_open_orders'; END IF;
  UPDATE public.table_sessions SET status='closed',closed_at=now() WHERE id=sess.id;
  UPDATE public.venue_tables SET occupancy_status='free',occupied_since=NULL,current_session_id=NULL WHERE id=t.id;
  RETURN jsonb_build_object('ok',true,'closed',true,'table_id',t.id,'session_id',sess.id);
END;
$$;

-- Existing staff pages already call these RPC names; keep them as compatibility wrappers.
CREATE OR REPLACE FUNCTION public.cook_release_table(p_token text,p_table_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; BEGIN r:=public.staff_close_table_session(p_token,p_table_id); RETURN coalesce((r->>'ok')::boolean,false); END; $$;
CREATE OR REPLACE FUNCTION public.waiter_release_table(p_token text,p_table_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; BEGIN r:=public.staff_close_table_session(p_token,p_table_id); RETURN coalesce((r->>'ok')::boolean,false); END; $$;

-- QR orders automatically create/reuse a session and attach every order to it.
CREATE OR REPLACE FUNCTION public.create_public_order(p_venue_id uuid,p_order_type text,p_customer_name text,p_customer_phone text,p_delivery_address text,p_comment text,p_payment_method text,p_items jsonb,p_addons jsonb,p_total_price numeric,p_table_token text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_order public.orders; v_item jsonb; v_addon jsonb; v_product public.products; v_table public.venue_tables; v_session public.table_sessions; v_qty integer; v_base_total numeric:=0; v_addon_total numeric:=0; v_expected_total numeric:=0;
begin
 if not exists(select 1 from public.venues where id=p_venue_id and status='active') then raise exception 'venue_not_found'; end if;
 if p_order_type not in ('pickup','delivery') then raise exception 'invalid_order_type'; end if;
 if nullif(trim(p_customer_phone),'') is null then raise exception 'customer_phone_required'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'order_items_required'; end if;
 if p_order_type='delivery' and nullif(trim(p_delivery_address),'') is null then raise exception 'delivery_address_required'; end if;
 if nullif(trim(p_table_token),'') is not null then
   select * into v_table from public.venue_tables where venue_id=p_venue_id and qr_token=trim(p_table_token) and is_active=true limit 1 for update;
   if v_table.id is null then raise exception 'table_not_found'; end if;
   if v_table.current_session_id is not null then
     select * into v_session from public.table_sessions where id=v_table.current_session_id and status='active' for update;
   end if;
   if v_session.id is null then
     insert into public.table_sessions(venue_id,table_id,status) values(p_venue_id,v_table.id,'active') returning * into v_session;
     update public.venue_tables set occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=v_session.id where id=v_table.id;
   end if;
 end if;
 insert into public.orders(venue_id,table_id,table_session_id,status,order_type,customer_name,customer_phone,delivery_address,comment,payment_method,items,addons,total_price)
 values(p_venue_id,v_table.id,v_session.id,'new',p_order_type,nullif(trim(p_customer_name),''),trim(p_customer_phone),nullif(trim(p_delivery_address),''),nullif(trim(p_comment),''),coalesce(nullif(trim(p_payment_method),''),'cash'),'[]'::jsonb,coalesce(p_addons,'[]'::jsonb),0) returning * into v_order;
 for v_item in select value from jsonb_array_elements(p_items) loop
   v_qty:=coalesce((v_item->>'qty')::integer,0); if v_qty<1 or v_qty>99 then raise exception 'invalid_item_quantity'; end if;
   select * into v_product from public.products where id=(v_item->>'product_id')::uuid and venue_id=p_venue_id and is_available=true and category<>'addon' limit 1;
   if v_product.id is null then raise exception 'product_not_available'; end if;
   v_base_total:=v_base_total+(v_product.price*v_qty);
   insert into public.order_items(order_id,product_id,name,price,qty) values(v_order.id,v_product.id,v_product.name,v_product.price,v_qty);
 end loop;
 if p_addons is not null and jsonb_typeof(p_addons)='array' then
   for v_addon in select value from jsonb_array_elements(p_addons) loop
     v_qty:=coalesce((v_addon->>'qty')::integer,0); if v_qty<1 or v_qty>99 then raise exception 'invalid_addon_quantity'; end if;
     select * into v_product from public.products where id=(v_addon->>'id')::uuid and venue_id=p_venue_id and is_available=true and category='addon' limit 1;
     if v_product.id is null then raise exception 'addon_not_available'; end if;
     v_addon_total:=v_addon_total+(v_product.price*v_qty);
     for i in 1..v_qty loop insert into public.order_addons(order_id,name,price,item_name) values(v_order.id,v_product.name,v_product.price,nullif(v_addon->>'item_name','')); end loop;
   end loop;
 end if;
 v_expected_total:=v_base_total+v_addon_total+case when p_order_type='delivery' then 150 else 0 end;
 if p_total_price is null or abs(p_total_price-v_expected_total)>0.01 then raise exception 'invalid_total_price'; end if;
 update public.orders set total_price=v_expected_total,items=p_items,addons=coalesce(p_addons,'[]'::jsonb) where id=v_order.id;
 if v_session.id is not null then update public.table_sessions set started_order_id=coalesce(started_order_id,v_order.id),last_order_id=v_order.id where id=v_session.id; end if;
 return jsonb_build_object('id',v_order.id,'order_number',v_order.order_number,'venue_id',v_order.venue_id,'table_id',v_order.table_id,'table_session_id',v_order.table_session_id,'status',v_order.status,'order_type',v_order.order_type,'customer_name',v_order.customer_name,'customer_phone',v_order.customer_phone,'delivery_address',v_order.delivery_address,'comment',v_order.comment,'payment_method',v_order.payment_method,'items',p_items,'addons',coalesce(p_addons,'[]'::jsonb),'total_price',v_expected_total,'created_at',v_order.created_at);
end $function$;

GRANT EXECUTE ON FUNCTION public.staff_table_board(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_start_table_session(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_close_table_session(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cook_release_table(text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.waiter_release_table(text,uuid) TO anon,authenticated;
