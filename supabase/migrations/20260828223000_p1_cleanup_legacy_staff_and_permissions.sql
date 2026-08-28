-- QR Menu — P1 cleanup of legacy manager API surface
-- Date: 2026-08-28

begin;

-- manager_reset_staff_pin is the canonical implementation.
-- The historical v2 duplicate is no longer exposed to API roles.
revoke execute on function public.manager_reset_staff_pin_v2(uuid,uuid,text) from anon, authenticated;

commit;
