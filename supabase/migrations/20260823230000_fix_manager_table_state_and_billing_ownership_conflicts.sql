-- Stabilize the manager table lifecycle after the session 2.0 migration.
-- The manager UI uses manager_set_table_status for reserve/free, so this RPC
-- must clear all transient occupancy/reservation fields consistently.

CREATE OR REPLACE FUNCTION public.manager_set_table_status(
  p_venue_id uuid,
  p_table_id uuid,
  p_status text,
  p_reserved_until timestamptz DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.venue_tables;
  sess public.table_sessions;
  open_count integer;
BEGIN
  IF NOT public.manager_can_manage_venue(p_venue_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  SELECT * INTO t
  FROM public.venue_tables
  WHERE id=p_table_id AND venue_id=p_venue_id AND is_active=true
  FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'table_not_found'; END IF;

  IF p_status='free' THEN
    IF t.current_session_id IS NOT NULL THEN
      SELECT * INTO sess
      FROM public.table_sessions
      WHERE id=t.current_session_id AND status='active'
      FOR UPDATE;

      IF sess.id IS NOT NULL THEN
        SELECT count(*) INTO open_count
        FROM public.orders
        WHERE table_session_id=sess.id
          AND status IN ('new','cooking','ready','delivery','changed');
        IF open_count>0 THEN
          RAISE EXCEPTION 'table_has_open_orders';
        END IF;
        UPDATE public.table_sessions
        SET status='closed', closed_at=now()
        WHERE id=sess.id;
      END IF;
    END IF;

    UPDATE public.venue_tables
    SET occupancy_status='free',
        occupied_since=NULL,
        current_session_id=NULL,
        reserved_until=NULL,
        reserved_note=NULL,
        guest_count=0,
        reservation_name=NULL,
        reservation_phone=NULL
    WHERE id=t.id;

    RETURN jsonb_build_object('ok',true,'status','free','table_id',t.id);

  ELSIF p_status='reserved' THEN
    IF t.occupancy_status='occupied' THEN
      RAISE EXCEPTION 'table_is_occupied';
    END IF;

    IF t.current_session_id IS NOT NULL THEN
      SELECT * INTO sess
      FROM public.table_sessions
      WHERE id=t.current_session_id
      FOR UPDATE;
      IF sess.id IS NOT NULL AND sess.status='active' THEN
        RAISE EXCEPTION 'table_is_occupied';
      END IF;
    END IF;

    UPDATE public.venue_tables
    SET occupancy_status='reserved',
        occupied_since=NULL,
        current_session_id=NULL,
        guest_count=0,
        reserved_until=p_reserved_until,
        reserved_note=nullif(trim(p_note),''),
        reservation_name=NULL,
        reservation_phone=NULL
    WHERE id=t.id;

    RETURN jsonb_build_object('ok',true,'status','reserved','table_id',t.id);

  ELSIF p_status='occupied' THEN
    IF t.current_session_id IS NOT NULL AND t.occupancy_status='occupied' THEN
      RETURN jsonb_build_object('ok',true,'status','occupied','already_active',true,'table_id',t.id);
    END IF;

    INSERT INTO public.table_sessions(venue_id,table_id,status,guest_count,opened_by_type,opened_by_id)
    VALUES(p_venue_id,t.id,'active',0,'manager',auth.uid())
    RETURNING * INTO sess;

    UPDATE public.venue_tables
    SET occupancy_status='occupied',
        occupied_since=now(),
        current_session_id=sess.id,
        reserved_until=NULL,
        reserved_note=NULL,
        reservation_name=NULL,
        reservation_phone=NULL
    WHERE id=t.id;

    RETURN jsonb_build_object('ok',true,'status','occupied','session_id',sess.id,'table_id',t.id);

  ELSE
    RAISE EXCEPTION 'invalid_status';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.manager_set_table_status(uuid,uuid,text,timestamptz,text) TO authenticated;

UPDATE public.venue_tables
SET guest_count=0,
    occupied_since=NULL,
    current_session_id=NULL,
    reserved_until=NULL,
    reserved_note=NULL,
    reservation_name=NULL,
    reservation_phone=NULL
WHERE occupancy_status='free'
  AND current_session_id IS NULL;

UPDATE public.venue_tables t
SET current_session_id=NULL,
    occupancy_status=CASE WHEN t.occupancy_status='occupied' THEN 'free' ELSE t.occupancy_status END,
    occupied_since=CASE WHEN t.occupancy_status='occupied' THEN NULL ELSE t.occupied_since END,
    guest_count=CASE WHEN t.occupancy_status='occupied' THEN 0 ELSE t.guest_count END
WHERE t.current_session_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.table_sessions s
    WHERE s.id=t.current_session_id AND s.status='active'
  );
