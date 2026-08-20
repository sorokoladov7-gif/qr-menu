-- Fix legacy staff RPCs still interpreting the current session token as UUID.
-- No schema changes; preserves existing RPC signatures and response shapes.

CREATE OR REPLACE FUNCTION public.staff_orders_json(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.staff_sessions;
  v_orders jsonb;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token = p_token AND expires_at > now();
  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_session'); END IF;
  SELECT jsonb_agg(o) INTO v_orders
  FROM (
    SELECT o.*,
      (SELECT jsonb_agg(oi) FROM public.order_items oi WHERE oi.order_id = o.id) AS items,
      (SELECT jsonb_agg(oa) FROM public.order_addons oa WHERE oa.order_id = o.id) AS addons
    FROM public.orders o
    WHERE o.venue_id = s.venue_id
      AND ((s.staff_type = 'cook' AND o.status NOT IN ('cancelled','done'))
        OR (s.staff_type = 'courier' AND o.status IN ('ready','delivery','arrived') AND o.order_type = 'delivery')
        OR (s.staff_type = 'waiter' AND o.status IN ('ready','cooking','new') AND (o.order_type <> 'delivery' OR o.order_type IS NULL)))
    ORDER BY o.created_at DESC
  ) o;
  RETURN COALESCE(v_orders, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_history_json(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.staff_sessions;
  v_history jsonb;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token = p_token AND expires_at > now();
  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_session'); END IF;
  SELECT jsonb_agg(o) INTO v_history
  FROM (
    SELECT o.*,
      (SELECT jsonb_agg(oi) FROM public.order_items oi WHERE oi.order_id = o.id) AS items,
      (SELECT jsonb_agg(oa) FROM public.order_addons oa WHERE oa.order_id = o.id) AS addons
    FROM public.orders o
    WHERE o.venue_id = s.venue_id AND o.status = 'done'
      AND ((s.staff_type = 'cook' AND o.cook_name = (SELECT c.name FROM public.cooks c WHERE c.id = s.staff_id))
        OR (s.staff_type = 'courier' AND o.courier_name = (SELECT c.name FROM public.couriers c WHERE c.id = s.staff_id))
        OR (s.staff_type = 'waiter' AND o.waiter_name = (SELECT w.name FROM public.waiters w WHERE w.id = s.staff_id)))
    ORDER BY o.created_at DESC LIMIT 20
  ) o;
  RETURN COALESCE(v_history, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_update_order(p_token text, p_order_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.staff_sessions;
  v_old_status text;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token = p_token AND expires_at > now();
  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_session'); END IF;
  SELECT status INTO v_old_status FROM public.orders WHERE id = p_order_id AND venue_id = s.venue_id;
  IF v_old_status IS NULL THEN RETURN jsonb_build_object('error', 'Order not found or not in your venue'); END IF;
  UPDATE public.orders SET status = p_status, updated_at = now() WHERE id = p_order_id AND venue_id = s.venue_id;
  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.waiter_get_table_dashboard(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s public.staff_sessions;
  v_tables jsonb;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token = p_token AND expires_at > now();
  IF s.id IS NULL OR s.staff_type <> 'waiter' THEN RETURN jsonb_build_object('error', 'invalid_session'); END IF;
  SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_tables
  FROM (
    SELECT jsonb_build_object(
      'id', t.id, 'table_number', t.table_number, 'name', t.name, 'seats', t.seats,
      'occupancy_status', t.occupancy_status,
      'session', CASE WHEN ts.id IS NOT NULL THEN jsonb_build_object(
        'id', ts.id, 'started_at', ts.started_at,
        'order_count', (SELECT count(*) FROM public.orders o WHERE o.table_session_id = ts.id AND o.status <> 'done'),
        'total_price', (SELECT COALESCE(sum(o.total_price),0) FROM public.orders o WHERE o.table_session_id = ts.id AND o.status <> 'done')
      ) ELSE NULL END
    ) AS x
    FROM public.venue_tables t
    LEFT JOIN public.table_sessions ts ON ts.id = t.current_session_id AND ts.status = 'active'
    WHERE t.venue_id = s.venue_id AND t.is_active = true
    ORDER BY t.table_number
  ) sub;
  RETURN v_tables;
END;
$$;
