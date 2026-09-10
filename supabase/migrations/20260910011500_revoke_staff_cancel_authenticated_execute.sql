begin;

-- Corrective ACL hardening: this token-authenticated staff RPC must not be
-- executable by the signed-in Supabase role. The anonymous staff PWA remains
-- supported through its explicit anon grant.
revoke execute on function public.staff_cancel_order(text,uuid,text) from authenticated;

commit;
