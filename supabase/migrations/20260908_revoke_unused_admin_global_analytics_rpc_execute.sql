-- Security consolidation: admin_global_analytics is not used by the current admin UI.
-- Current admin statistics are loaded directly by js/admin/admin-statistics.js.
-- Keep the function for internal/service-role compatibility, but do not expose it to clients.

begin;

revoke execute on function public.admin_global_analytics(integer) from public, anon, authenticated;
grant execute on function public.admin_global_analytics(integer) to service_role;

commit;
