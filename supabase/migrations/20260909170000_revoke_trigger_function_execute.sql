-- Harden the database runtime boundary.
-- Trigger callbacks are not client RPC endpoints. Their EXECUTE privilege is
-- therefore not needed by PUBLIC/anon/authenticated; PostgreSQL still invokes
-- trigger functions through their trigger context.

REVOKE EXECUTE ON FUNCTION public.delete_manager_auth_user_after_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_feature_defaults() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_profile_create() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_venue_link() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_venue_feature_defaults() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_manager_payment_request() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_modifier_permission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_product_permission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_venue_design_access() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_venue_permission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hash_staff_pin_on_write() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_global_recipe_photo_url() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_manager_subscription_owner() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.normalize_menu_template_row() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.payment_accounts_set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_menu_template_catalog_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_menu_templates_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.site_analyzer_learning_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_manager_subscription_to_venues() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_manager_venue_permissions_from_venue() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_menu_template_children() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_qr_guest_count_from_order() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_rk_normalized_modifiers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_venue_integrations_updated_at() FROM PUBLIC;

-- Explicitly keep the callable runtime roles closed as well. This documents
-- the intended policy and makes the migration idempotent with respect to
-- inherited PUBLIC grants.
REVOKE EXECUTE ON FUNCTION public.delete_manager_auth_user_after_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_feature_defaults() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_profile_create() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_subscription_on_venue_link() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_manager_venue_feature_defaults() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_manager_payment_request() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_modifier_permission() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_product_permission() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_venue_design_access() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_venue_permission() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_staff_pin_on_write() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_global_recipe_photo_url() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_manager_subscription_owner() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_menu_template_row() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.payment_accounts_set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_menu_template_catalog_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_menu_templates_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.site_analyzer_learning_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_manager_subscription_to_venues() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_manager_venue_permissions_from_venue() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_menu_template_children() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_qr_guest_count_from_order() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_rk_normalized_modifiers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_venue_integrations_updated_at() FROM anon, authenticated;
