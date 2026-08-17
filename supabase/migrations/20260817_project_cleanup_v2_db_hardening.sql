-- PROJECT CLEANUP v2: safe DB consolidation/hardening
-- No business tables or live staff/customer APIs are removed here.

DROP INDEX IF EXISTS public.products_venue_idx;

CREATE INDEX IF NOT EXISTS couriers_venue_id_idx ON public.couriers (venue_id);
CREATE INDEX IF NOT EXISTS waiters_venue_id_idx ON public.waiters (venue_id);
CREATE INDEX IF NOT EXISTS manager_venues_venue_id_idx ON public.manager_venues (venue_id);
CREATE INDEX IF NOT EXISTS subscriptions_plan_id_idx ON public.subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS subscriptions_venue_id_idx ON public.subscriptions (venue_id);
CREATE INDEX IF NOT EXISTS table_sessions_started_order_id_idx ON public.table_sessions (started_order_id);
CREATE INDEX IF NOT EXISTS table_sessions_last_order_id_idx ON public.table_sessions (last_order_id);
CREATE INDEX IF NOT EXISTS venue_tables_current_session_id_idx ON public.venue_tables (current_session_id);

CREATE OR REPLACE FUNCTION public.track_order(oid uuid)
RETURNS TABLE(status text, order_number bigint, order_type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.status, o.order_number, o.order_type
  FROM public.orders AS o
  WHERE o.id = oid;
$$;

CREATE OR REPLACE FUNCTION public.check_subscription_expiry()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.venues
     SET status = 'paused'
   WHERE id IN (
     SELECT venue_id FROM public.subscriptions
      WHERE expires_at < now() AND status IN ('active', 'trial')
   ) AND status = 'active';

  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE expires_at < now() AND status IN ('active', 'trial');
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_menu_templates_updated_at'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.set_menu_templates_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = public
      AS $body$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $body$
    $fn$;
  END IF;
END $$;
