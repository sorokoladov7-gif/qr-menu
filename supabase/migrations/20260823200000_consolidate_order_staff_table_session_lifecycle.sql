-- P0/P1 lifecycle consistency fixes.
-- A changed order is shown to the cook as a new work item, so it must be allowed to enter cooking.
-- Cook table control must use the same ACTIVE waiter rule as its dashboard.
-- Reservation must clear stale session/guest state.
-- Staff status transitions are serialized to avoid races.

CREATE OR REPLACE FUNCTION public.cook_can_control_tables(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.waiters w
    WHERE w.venue_id=p_venue_id AND w.is_active=true
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_update_order(p_token text,p_order_id uuid,p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions; v_old_status text; v_allowed boolean:=false;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RETURN jsonb_build_object('error','invalid_session'); END IF;

  SELECT status INTO v_old_status FROM public.orders
  WHERE id=p_order_id AND venue_id=s.venue_id FOR UPDATE;
  IF v_old_status IS NULL THEN RETURN jsonb_build_object('error','order_not_found'); END IF;

  IF s.staff_type='cook' THEN
    v_allowed := (v_old_status IN ('new','changed') AND p_status='cooking')
              OR (v_old_status='cooking' AND p_status='ready')
              OR (v_old_status='ready' AND p_status='done');
  ELSIF s.staff_type='waiter' THEN
    v_allowed := (v_old_status='ready' AND p_status='done');
  ELSIF s.staff_type='courier' THEN
    v_allowed := (v_old_status='ready' AND p_status='delivery')
              OR (v_old_status='delivery' AND p_status='arrived')
              OR (v_old_status='arrived' AND p_status='done');
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('error','invalid_status_transition','staff_type',s.staff_type,'old_status',v_old_status,'requested_status',p_status);
  END IF;

  UPDATE public.orders SET status=p_status,updated_at=now()
  WHERE id=p_order_id AND venue_id=s.venue_id;
  RETURN jsonb_build_object('success',true,'old_status',v_old_status,'new_status',p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.waiter_reserve_table(p_token text,p_table_id uuid,p_reserved_until timestamptz DEFAULT NULL,p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions; t public.venue_tables; sess public.table_sessions;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL OR s.staff_type<>'waiter' THEN RAISE EXCEPTION 'invalid_session'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF t.occupancy_status='occupied' THEN RAISE EXCEPTION 'table_is_occupied'; END IF;
  IF t.current_session_id IS NOT NULL THEN
    SELECT * INTO sess FROM public.table_sessions WHERE id=t.current_session_id FOR UPDATE;
    IF sess.id IS NOT NULL AND sess.status='active' THEN RAISE EXCEPTION 'table_has_active_session'; END IF;
  END IF;
  UPDATE public.venue_tables SET occupancy_status='reserved',occupied_since=NULL,current_session_id=NULL,guest_count=0,
    reserved_until=GREATEST(COALESCE(p_reserved_until,now()+interval '2 hours'),now()),reserved_note=NULLIF(trim(p_note),''),
    reservation_name=NULL,reservation_phone=NULL WHERE id=t.id;
  RETURN jsonb_build_object('ok',true,'status','reserved','table_id',t.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cook_reserve_table(p_token text,p_table_id uuid,p_reserved_until timestamptz DEFAULT (now()+interval '2 hours'),p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE s public.staff_sessions; t public.venue_tables; sess public.table_sessions;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND staff_type='cook' AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables('cook',s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;
  IF t.occupancy_status='occupied' THEN RAISE EXCEPTION 'table_is_occupied'; END IF;
  IF t.current_session_id IS NOT NULL THEN
    SELECT * INTO sess FROM public.table_sessions WHERE id=t.current_session_id FOR UPDATE;
    IF sess.id IS NOT NULL AND sess.status='active' THEN RAISE EXCEPTION 'table_has_active_session'; END IF;
  END IF;
  UPDATE public.venue_tables SET occupancy_status='reserved',occupied_since=NULL,current_session_id=NULL,guest_count=0,
    reserved_until=GREATEST(COALESCE(p_reserved_until,now()+interval '2 hours'),now()),reserved_note=NULLIF(trim(p_note),''),
    reservation_name=NULL,reservation_phone=NULL WHERE id=t.id;
  RETURN jsonb_build_object('success',true,'table_id',t.id,'occupancy_status','reserved');
END;
$$;
