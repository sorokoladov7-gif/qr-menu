-- Canonical staff order lifecycle.
-- The current cook/waiter/courier frontends use staff_update_order.
-- Delivery orders must not be completed by the cook or waiter.

CREATE OR REPLACE FUNCTION public.staff_update_order(
  p_token text,
  p_order_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.staff_sessions;
  o public.orders%rowtype;
  v_allowed boolean := false;
  v_staff_name text;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RETURN jsonb_build_object('error','invalid_session'); END IF;

  SELECT * INTO o FROM public.orders WHERE id=p_order_id AND venue_id=s.venue_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF s.staff_type='cook' THEN
    v_allowed := (o.status IN ('new','changed') AND p_status='cooking')
      OR (o.status='cooking' AND p_status='ready')
      OR (o.status='ready' AND p_status='done' AND coalesce(o.order_type,'') <> 'delivery');
  ELSIF s.staff_type='waiter' THEN
    v_allowed := (o.status='ready' AND p_status='delivery' AND o.order_type='delivery')
      OR (o.status='ready' AND p_status='done' AND coalesce(o.order_type,'') <> 'delivery');
  ELSIF s.staff_type='courier' THEN
    v_allowed := (o.status='ready' AND p_status='delivery' AND o.order_type='delivery')
      OR (o.status='delivery' AND p_status='arrived' AND o.order_type='delivery')
      OR (o.status='arrived' AND p_status='done' AND o.order_type='delivery');
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error','invalid_status_transition','staff_type',s.staff_type,'old_status',o.status,'requested_status',p_status,'order_type',o.order_type);
  END IF;

  IF s.staff_type='waiter' THEN SELECT name INTO v_staff_name FROM public.waiters WHERE id=s.staff_id;
  ELSIF s.staff_type='cook' THEN SELECT name INTO v_staff_name FROM public.cooks WHERE id=s.staff_id;
  ELSE SELECT name INTO v_staff_name FROM public.couriers WHERE id=s.staff_id;
  END IF;

  UPDATE public.orders
  SET status=p_status,
      updated_at=now(),
      waiter_name=CASE WHEN s.staff_type='waiter' THEN v_staff_name ELSE waiter_name END,
      cook_name=CASE WHEN s.staff_type='cook' THEN v_staff_name ELSE cook_name END,
      courier_name=CASE WHEN s.staff_type='courier' AND p_status='delivery' THEN v_staff_name ELSE courier_name END
  WHERE id=o.id;

  RETURN jsonb_build_object('success',true,'old_status',o.status,'new_status',p_status,'order_id',o.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_update_order(text,uuid,text) TO authenticated,anon;

CREATE OR REPLACE FUNCTION public.staff_reserve_table(
  p_token text,p_table_id uuid,p_reserved_until timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL,p_guest_name text DEFAULT NULL,p_guest_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; t public.venue_tables%rowtype; sess public.table_sessions%rowtype;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF t.occupancy_status='occupied' THEN RAISE EXCEPTION 'table_is_occupied'; END IF;
  IF t.current_session_id IS NOT NULL THEN
    SELECT * INTO sess FROM public.table_sessions WHERE id=t.current_session_id FOR UPDATE;
    IF sess.id IS NOT NULL AND sess.status='active' THEN RAISE EXCEPTION 'table_has_active_session'; END IF;
  END IF;
  UPDATE public.venue_tables SET occupancy_status='reserved',occupied_since=NULL,current_session_id=NULL,guest_count=0,
    reserved_until=GREATEST(COALESCE(p_reserved_until,now()+interval '2 hours'),now()),reserved_note=NULLIF(trim(p_note),''),
    reservation_name=NULLIF(trim(p_guest_name),''),reservation_phone=NULLIF(trim(p_guest_phone),'') WHERE id=t.id;
  RETURN jsonb_build_object('ok',true,'status','reserved','table_id',t.id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.staff_reserve_table(text,uuid,timestamptz,text,text,text) TO authenticated,anon;

CREATE OR REPLACE FUNCTION public.close_staff_shift(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; sh public.staff_shifts%rowtype; active_orders int; active_tables int;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF s.staff_type NOT IN ('cook','waiter','courier') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT count(*) INTO active_orders FROM public.orders WHERE venue_id=s.venue_id AND status NOT IN ('done','cancelled');
  IF active_orders>0 THEN RAISE EXCEPTION 'active_orders_exist:%',active_orders; END IF;
  IF s.staff_type IN ('cook','waiter') THEN
    SELECT count(*) INTO active_tables FROM public.table_sessions WHERE venue_id=s.venue_id AND status='active';
    IF active_tables>0 THEN RAISE EXCEPTION 'active_table_sessions_exist:%',active_tables; END IF;
  END IF;
  PERFORM public.rebuild_venue_day_stats(s.venue_id,current_date);
  SELECT * INTO sh FROM public.staff_shifts WHERE staff_type=s.staff_type AND staff_id=s.staff_id AND venue_id=s.venue_id AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1;
  IF sh.id IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','shift_not_open'); END IF;
  UPDATE public.staff_shifts SET ended_at=now(),closed_by=s.staff_id WHERE id=sh.id;
  UPDATE public.venue_day_stats SET closed_at=now(),closed_by=s.staff_id,updated_at=now() WHERE venue_id=s.venue_id AND business_date=current_date;
  INSERT INTO public.venue_workday_state(venue_id,reset_at,updated_at) VALUES(s.venue_id,now(),now()) ON CONFLICT(venue_id) DO UPDATE SET reset_at=excluded.reset_at,updated_at=now();
  RETURN jsonb_build_object('ok',true,'shift_id',sh.id,'ended_at',now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_staff_shift(text) TO authenticated,anon;

CREATE OR REPLACE FUNCTION public.reset_staff_workday(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; r timestamptz:=now(); active_count integer; active_tables integer;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF s.staff_type NOT IN ('cook','waiter') THEN RAISE EXCEPTION 'not_allowed'; END IF;
  SELECT count(*) INTO active_count FROM public.orders WHERE venue_id=s.venue_id AND status NOT IN ('done','cancelled');
  IF active_count>0 THEN RAISE EXCEPTION 'active_orders_exist:%',active_count; END IF;
  SELECT count(*) INTO active_tables FROM public.table_sessions WHERE venue_id=s.venue_id AND status='active';
  IF active_tables>0 THEN RAISE EXCEPTION 'active_table_sessions_exist:%',active_tables; END IF;
  PERFORM public.rebuild_venue_day_stats(s.venue_id,current_date);
  UPDATE public.venue_day_stats SET closed_at=now(),closed_by=s.staff_id,updated_at=now() WHERE venue_id=s.venue_id AND business_date=current_date;
  INSERT INTO public.venue_workday_state(venue_id,reset_at,updated_at) VALUES(s.venue_id,r,r) ON CONFLICT(venue_id) DO UPDATE SET reset_at=excluded.reset_at,updated_at=now();
  RETURN jsonb_build_object('ok',true,'reset_at',r,'business_date',current_date);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_staff_workday(text) TO authenticated,anon;

CREATE OR REPLACE FUNCTION public.close_venue_day(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions%rowtype; d date:=current_date; active_orders integer; active_tables integer;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF s.staff_type NOT IN ('cook','waiter') THEN RAISE EXCEPTION 'manager_only'; END IF;
  SELECT count(*) INTO active_orders FROM public.orders WHERE venue_id=s.venue_id AND status NOT IN ('done','cancelled');
  IF active_orders>0 THEN RAISE EXCEPTION 'active_orders_exist:%',active_orders; END IF;
  SELECT count(*) INTO active_tables FROM public.table_sessions WHERE venue_id=s.venue_id AND status='active';
  IF active_tables>0 THEN RAISE EXCEPTION 'active_table_sessions_exist:%',active_tables; END IF;
  PERFORM public.rebuild_venue_day_stats(s.venue_id,d);
  UPDATE public.venue_day_stats SET closed_at=now(),closed_by=s.staff_id,updated_at=now() WHERE venue_id=s.venue_id AND business_date=d;
  RETURN jsonb_build_object('ok',true,'venue_id',s.venue_id,'business_date',d);
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_venue_day(text) TO authenticated,anon;

-- Current waiter frontend uses staff_create_session_order and staff_update_order.
-- Retire old paths that bypassed the canonical staff-session model.
DROP FUNCTION IF EXISTS public.waiter_add_order_to_table(text,uuid,text,text,jsonb,jsonb,text);
DROP FUNCTION IF EXISTS public.waiter_send_delivery(text,uuid);
DROP FUNCTION IF EXISTS public.waiter_serve_order(text,uuid);
