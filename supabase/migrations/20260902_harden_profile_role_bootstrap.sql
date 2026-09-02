-- QR Menu: harden profile role bootstrap
-- Prevents non-admin/system inserts from creating admin profiles.
-- Keeps normal signup path as manager-only.

create or replace function public.guard_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.role is null then
      new.role := 'manager';
    elsif new.role = 'admin' then
      if auth.uid() is null then
        if current_setting('role', true) <> 'service_role' then
          raise exception 'role_change_forbidden' using errcode = '42501';
        end if;
      elsif not public.is_admin() then
        raise exception 'role_change_forbidden' using errcode = '42501';
      end if;
    elsif new.role <> 'manager' then
      raise exception 'invalid_profile_role' using errcode = '22023';
    end if;
  elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.uid() is null then
      if current_setting('role', true) <> 'service_role' then
        raise exception 'role_change_forbidden' using errcode = '42501';
      end if;
    elsif not public.is_admin() then
      raise exception 'role_change_forbidden' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_role_change() from public;
