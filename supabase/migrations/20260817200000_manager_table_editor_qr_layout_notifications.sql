-- Manager hall: secure table CRUD, QR regeneration, layout persistence,
-- richer board data and waiter visibility of new table orders.
-- Applied to Supabase production as migration manager_table_editor_qr_layout_notifications.

CREATE OR REPLACE FUNCTION public.manager_can_manage_venue(p_venue_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')
OR EXISTS (SELECT 1 FROM public.manager_venues mv WHERE mv.venue_id=p_venue_id AND mv.manager_id=auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.manager_table_board(p_venue_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb;
BEGIN
IF NOT public.manager_can_manage_venue(p_venue_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
SELECT coalesce(jsonb_agg(x ORDER BY x.table_number),'[]'::jsonb) INTO result FROM (
SELECT t.id,t.venue_id,t.table_number,t.name,t.qr_token,t.is_active,t.pos_x,t.pos_y,t.seats,t.shape,t.occupancy_status,t.occupied_since,t.current_session_id,
ts.started_at session_started_at,ts.last_order_id,
coalesce((SELECT count(*) FROM public.orders o WHERE o.table_session_id=ts.id),0) order_count,
coalesce((SELECT sum(o.total_price) FROM public.orders o WHERE o.table_session_id=ts.id AND o.status<>'cancelled'),0) total_amount,
coalesce((SELECT count(*) FROM public.orders o WHERE o.table_session_id=ts.id AND o.status IN ('new','cooking','ready','delivery','changed')),0) open_order_count
FROM public.venue_tables t LEFT JOIN public.table_sessions ts ON ts.id=t.current_session_id AND ts.status='active'
WHERE t.venue_id=p_venue_id AND t.is_active=true) x;
RETURN jsonb_build_object('ok',true,'venue_id',p_venue_id,'tables',result);
END; $$;

CREATE OR REPLACE FUNCTION public.manager_upsert_table(p_venue_id uuid,p_table_id uuid DEFAULT NULL,p_table_number integer DEFAULT NULL,p_name text DEFAULT NULL,p_seats integer DEFAULT 4,p_shape text DEFAULT 'round',p_pos_x integer DEFAULT 80,p_pos_y integer DEFAULT 80)
RETURNS public.venue_tables LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.venue_tables; next_num integer;
BEGIN
IF NOT public.manager_can_manage_venue(p_venue_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
IF p_seats<1 OR p_seats>50 THEN RAISE EXCEPTION 'invalid_seats'; END IF;
IF p_shape NOT IN ('round','square','rectangle') THEN RAISE EXCEPTION 'invalid_shape'; END IF;
IF p_pos_x<10 OR p_pos_x>2000 OR p_pos_y<10 OR p_pos_y>2000 THEN RAISE EXCEPTION 'invalid_position'; END IF;
IF p_table_id IS NULL THEN SELECT coalesce(max(table_number),0)+1 INTO next_num FROM public.venue_tables WHERE venue_id=p_venue_id;
INSERT INTO public.venue_tables(venue_id,table_number,name,seats,shape,pos_x,pos_y) VALUES(p_venue_id,coalesce(p_table_number,next_num),nullif(trim(p_name),''),p_seats,p_shape,p_pos_x,p_pos_y) RETURNING * INTO r;
ELSE UPDATE public.venue_tables SET table_number=coalesce(p_table_number,table_number),name=nullif(trim(p_name),''),seats=p_seats,shape=p_shape,pos_x=p_pos_x,pos_y=p_pos_y WHERE id=p_table_id AND venue_id=p_venue_id AND is_active=true RETURNING * INTO r;
IF r.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF; END IF; RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.manager_regenerate_table_qr(p_venue_id uuid,p_table_id uuid)
RETURNS public.venue_tables LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.venue_tables;
BEGIN IF NOT public.manager_can_manage_venue(p_venue_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
UPDATE public.venue_tables SET qr_token=replace(gen_random_uuid()::text,'-','') WHERE id=p_table_id AND venue_id=p_venue_id AND is_active=true RETURNING * INTO r;
IF r.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF; RETURN r; END; $$;

CREATE OR REPLACE FUNCTION public.manager_delete_table(p_venue_id uuid,p_table_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE active_orders integer; active_session uuid;
BEGIN IF NOT public.manager_can_manage_venue(p_venue_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
SELECT current_session_id INTO active_session FROM public.venue_tables WHERE id=p_table_id AND venue_id=p_venue_id AND is_active=true;
IF active_session IS NOT NULL THEN RAISE EXCEPTION 'table_has_active_session'; END IF;
SELECT count(*) INTO active_orders FROM public.orders WHERE table_id=p_table_id AND status IN ('new','cooking','ready','delivery','changed');
IF active_orders>0 THEN RAISE EXCEPTION 'table_has_open_orders'; END IF;
UPDATE public.venue_tables SET is_active=false WHERE id=p_table_id AND venue_id=p_venue_id; RETURN FOUND; END; $$;

GRANT EXECUTE ON FUNCTION public.manager_table_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_upsert_table(uuid,uuid,integer,text,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_regenerate_table_qr(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_delete_table(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_orders_json(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare s public.staff_sessions; result jsonb;
begin select * into s from public.staff_sessions where token=p_token and expires_at>now();
if s.id is null then raise exception 'invalid_session'; end if;
select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'order_number',o.order_number,'status',o.status,'order_type',o.order_type,'customer_name',o.customer_name,'customer_phone',o.customer_phone,'delivery_address',o.delivery_address,'payment_method',o.payment_method,'total_price',o.total_price,'comment',o.comment,'cook_name',o.cook_name,'courier_name',o.courier_name,'waiter_name',o.waiter_name,'table_id',o.table_id,'table_session_id',o.table_session_id,'table_name',(select vt.name from public.venue_tables vt where vt.id=o.table_id),'table_number',(select vt.table_number from public.venue_tables vt where vt.id=o.table_id),'created_at',o.created_at,'updated_at',o.updated_at,'cooking_started_at',o.cooking_started_at,'ready_at',o.ready_at,'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.order_items i where i.order_id=o.id),'[]'::jsonb),'addons',coalesce((select jsonb_agg(to_jsonb(a)) from public.order_addons a where a.order_id=o.id),'[]'::jsonb)) order by o.created_at desc),'[]'::jsonb) into result from public.orders o where o.venue_id=s.venue_id and ((s.staff_type='cook' and o.status in ('new','changed','cooking','ready','delivery')) or (s.staff_type='courier' and o.order_type='delivery' and o.status in ('ready','delivery') and (o.courier_name is null or o.courier_name=(select name from public.couriers where id=s.staff_id))) or (s.staff_type='waiter' and o.status in ('new','changed','cooking','ready','delivery')));
return result; end; $$;
GRANT EXECUTE ON FUNCTION public.staff_orders_json(text) TO anon,authenticated;
