-- The 5-argument staff_edit_order overload is not referenced by the application.
-- The active staff UI uses the 4-argument overload.
-- Keep the function for historical migration compatibility, but remove client execution access.

begin;

revoke execute on function public.staff_edit_order(text, uuid, jsonb, jsonb, text) from anon, authenticated;

commit;
