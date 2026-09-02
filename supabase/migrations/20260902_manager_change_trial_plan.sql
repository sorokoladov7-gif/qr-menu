-- QR Menu — безопасная смена тарифа управляющим во время Trial.
-- Меняет только plan_id канонической manager-owned подписки.
-- current_period_end, status и платёжные поля не изменяются.

CREATE OR REPLACE FUNCTION public.manager_change_trial_plan(p_plan_id text)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_sub public.subscriptions;
  v_plan public.plans;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode='42501';
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role <> 'manager' THEN
    RAISE EXCEPTION 'manager_only' USING errcode='42501';
  END IF;

  IF NULLIF(trim(p_plan_id), '') IS NULL THEN
    RAISE EXCEPTION 'plan_required' USING errcode='22023';
  END IF;

  SELECT * INTO v_plan
  FROM public.plans
  WHERE id = trim(p_plan_id)
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found' USING errcode='22023';
  END IF;

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE manager_id = v_uid
    AND venue_id IS NULL
    AND status = 'trialing'
    AND current_period_end >= now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trial_subscription_not_found' USING errcode='P0001';
  END IF;

  UPDATE public.subscriptions
  SET plan_id = v_plan.id
  WHERE id = v_sub.id
  RETURNING * INTO v_sub;

  RETURN v_sub;
END;
$$;

REVOKE ALL ON FUNCTION public.manager_change_trial_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manager_change_trial_plan(text) TO authenticated;
