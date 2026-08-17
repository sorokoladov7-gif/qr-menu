-- Keep existing staff UI RPC names compatible with Table Session 2.0.
CREATE OR REPLACE FUNCTION public.cook_get_table_dashboard(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; s jsonb;
BEGIN
  r:=public.staff_table_board(p_token);
  IF (r->>'staff_type')<>'cook' THEN RAISE EXCEPTION 'invalid_staff_type'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',x->'id','table_number',x->'table_number','name',x->'name','seats',x->'seats','shape',x->'shape','occupancy_status',x->'occupancy_status','occupied_since',x->'occupied_since','current_session_id',x->'current_session_id',
    'session',CASE WHEN x->>'current_session_id' IS NULL THEN NULL ELSE jsonb_build_object('id',x->'current_session_id','started_at',x->'session_started_at','last_order_id',x->'last_order_id','order_count',x->'order_count','total_price',x->'total_amount','open_order_count',x->'open_order_count') END
  )), '[]'::jsonb) INTO s FROM jsonb_array_elements(r->'tables') x;
  RETURN jsonb_build_object('waiter_count',CASE WHEN (r->>'can_control')='true' THEN 0 ELSE 1 END,'can_control_tables',(r->>'can_control')='true','control_role',CASE WHEN (r->>'can_control')='true' THEN 'cook' ELSE 'waiter' END,'tables',s);
END; $$;

CREATE OR REPLACE FUNCTION public.waiter_get_dashboard(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; s jsonb;
BEGIN
  r:=public.staff_table_board(p_token);
  IF (r->>'staff_type')<>'waiter' THEN RAISE EXCEPTION 'invalid_staff_type'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',x->'id','table_number',x->'table_number','name',x->'name','seats',x->'seats','shape',x->'shape','occupancy_status',x->'occupancy_status','occupied_since',x->'occupied_since','current_session_id',x->'current_session_id',
    'session',CASE WHEN x->>'current_session_id' IS NULL THEN NULL ELSE jsonb_build_object('id',x->'current_session_id','started_at',x->'session_started_at','last_order_id',x->'last_order_id','order_count',x->'order_count','total_price',x->'total_amount','open_order_count',x->'open_order_count') END
  )), '[]'::jsonb) INTO s FROM jsonb_array_elements(r->'tables') x;
  RETURN s;
END; $$;

CREATE OR REPLACE FUNCTION public.cook_release_table(p_token text,p_table_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; BEGIN r:=public.staff_close_table_session(p_token,p_table_id); RETURN coalesce((r->>'ok')::boolean,false); END; $$;

CREATE OR REPLACE FUNCTION public.waiter_release_table(p_token text,p_table_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb; BEGIN r:=public.staff_close_table_session(p_token,p_table_id); RETURN coalesce((r->>'ok')::boolean,false); END; $$;
