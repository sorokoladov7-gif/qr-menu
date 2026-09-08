-- Remove client EXECUTE access from legacy manager analytics RPCs that have no current repository callers.
-- Keep the functions themselves for historical/internal use; do not drop them.
REVOKE EXECUTE ON FUNCTION public.manager_detailed_analytics(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_venue_analytics_v2(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_venue_day_stats(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manager_staff_statistics(uuid, date, date) FROM PUBLIC, anon, authenticated;
