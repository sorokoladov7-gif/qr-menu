-- Preserve active frontend RPC names while routing table control through the validated Table Session 2.0 lifecycle.

CREATE OR REPLACE FUNCTION public.waiter_start_table_session(p_token text, p_table_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.staff_start_table_session(p_token, p_table_id);
$$;

CREATE OR REPLACE FUNCTION public.waiter_release_table(p_token text, p_table_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.staff_close_table_session(p_token, p_table_id);
$$;

CREATE OR REPLACE FUNCTION public.cook_start_table_session(p_token text, p_table_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.staff_sessions%rowtype;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL OR s.staff_type <> 'cook' THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  RETURN public.staff_start_table_session(p_token,p_table_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.cook_release_table(p_token text, p_table_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.staff_sessions%rowtype;
BEGIN
  SELECT * INTO s FROM public.staff_sessions WHERE token=p_token AND expires_at>now() LIMIT 1;
  IF s.id IS NULL OR s.staff_type <> 'cook' THEN RAISE EXCEPTION 'invalid_session'; END IF;
  IF NOT public.staff_can_control_tables(s.staff_type,s.venue_id) THEN RAISE EXCEPTION 'table_control_requires_waiter'; END IF;
  RETURN public.staff_close_table_session(p_token,p_table_id);
END;
$$;

-- waiter_create_session_order is hardened in production to bind every order to the active table_session_id,
-- require order_type='table', reject addon products and validate quantities. The full canonical definition
-- is kept in the production migration history; this repository file records the migration boundary.
