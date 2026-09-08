-- Remove an over-broad public modifier read policy.
-- Active public-menu access remains covered by modifiers_public_select.
-- Manager/admin access remains covered by authenticated policies.
drop policy if exists modifiers_public_read on public.modifiers;
