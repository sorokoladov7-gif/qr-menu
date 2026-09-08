-- staff_login is intentionally callable by the anonymous staff PWA,
-- but must not be executable through PUBLIC (which implicitly includes authenticated).
revoke execute on function public.staff_login(text,text,text) from public;
grant execute on function public.staff_login(text,text,text) to anon, service_role;
