-- Fix subscription expiry to match current schema.
CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.venues v
  SET status = 'paused'
  WHERE v.status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.venue_id = v.id
        AND s.status IN ('active','trialing')
        AND s.current_period_end < now()
    );

  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE current_period_end < now()
    AND status IN ('active','trialing');
END;
$function$;

-- One active guest session per table.
CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_one_active_per_table
ON public.table_sessions(table_id)
WHERE status = 'active';

-- Waiter can seat a guest before the first order.
CREATE OR REPLACE FUNCTION public.waiter_start_table_session(p_token text, p_table_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE s public.staff_sessions%rowtype; t public.venue_tables%rowtype; sess public.table_sessions%rowtype;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND staff_type='waiter' AND expires_at>now() LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Сессия официанта недействительна или истекла'; END IF;
  SELECT * INTO t FROM public.venue_tables WHERE id=p_table_id AND venue_id=s.venue_id AND is_active=true FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Стол не найден'; END IF;
  IF t.occupancy_status='occupied' AND t.current_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'session_id',t.current_session_id,'table_id',t.id,'controlled_by','waiter');
  END IF;
  INSERT INTO public.table_sessions(venue_id,table_id,status) VALUES(s.venue_id,t.id,'active') RETURNING * INTO sess;
  UPDATE public.venue_tables SET occupancy_status='occupied',occupied_since=now(),current_session_id=sess.id WHERE id=t.id;
  RETURN jsonb_build_object('ok',true,'session_id',sess.id,'table_id',t.id,'controlled_by','waiter');
END;
$function$;

-- Harden staff status transitions. Completing an order does not free a table.
CREATE OR REPLACE FUNCTION public.staff_update_order(p_token text, p_order_id uuid, p_status text)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE s public.staff_sessions; o public.orders; staff_name text;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now();
  IF s.id IS NULL THEN RAISE EXCEPTION 'invalid_session'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=p_order_id AND venue_id=s.venue_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;

  IF s.staff_type='cook' THEN
    SELECT name INTO staff_name FROM public.cooks WHERE id=s.staff_id;
    IF p_status NOT IN ('cooking','ready','delivery','done') THEN RAISE EXCEPTION 'invalid_cook_status'; END IF;
    IF p_status='cooking' AND o.status NOT IN ('new','changed') THEN RAISE EXCEPTION 'invalid_cook_transition'; END IF;
    IF p_status='ready' AND o.status<>'cooking' THEN RAISE EXCEPTION 'invalid_cook_transition'; END IF;
    IF p_status IN ('delivery','done') AND o.status NOT IN ('ready','delivery') THEN RAISE EXCEPTION 'invalid_cook_transition'; END IF;
    UPDATE public.orders SET status=p_status,cook_name=coalesce(staff_name,cook_name),cooking_started_at=CASE WHEN p_status='cooking' AND cooking_started_at IS NULL THEN now() ELSE cooking_started_at END,ready_at=CASE WHEN p_status='ready' THEN now() ELSE ready_at END,updated_at=now() WHERE id=o.id RETURNING * INTO o;
  ELSIF s.staff_type='courier' THEN
    SELECT name INTO staff_name FROM public.couriers WHERE id=s.staff_id;
    IF o.order_type<>'delivery' THEN RAISE EXCEPTION 'invalid_courier_operation'; END IF;
    IF p_status='delivery' THEN IF o.status<>'ready' THEN RAISE EXCEPTION 'invalid_courier_transition'; END IF;
    ELSIF p_status='done' THEN IF o.status<>'delivery' THEN RAISE EXCEPTION 'invalid_courier_transition'; END IF;
    ELSE RAISE EXCEPTION 'invalid_courier_operation'; END IF;
    UPDATE public.orders SET status=p_status,courier_name=coalesce(staff_name,courier_name),updated_at=now() WHERE id=o.id RETURNING * INTO o;
  ELSIF s.staff_type='waiter' THEN
    SELECT name INTO staff_name FROM public.waiters WHERE id=s.staff_id;
    IF p_status='delivery' THEN IF o.status<>'ready' THEN RAISE EXCEPTION 'invalid_waiter_transition'; END IF;
    ELSIF p_status='done' THEN IF o.status<>'ready' THEN RAISE EXCEPTION 'invalid_waiter_transition'; END IF;
    ELSE RAISE EXCEPTION 'invalid_waiter_status'; END IF;
    UPDATE public.orders SET status=p_status,waiter_name=coalesce(staff_name,waiter_name),updated_at=now() WHERE id=o.id RETURNING * INTO o;
  ELSE
    RAISE EXCEPTION 'invalid_staff_type';
  END IF;
  RETURN o;
END;
$function$;