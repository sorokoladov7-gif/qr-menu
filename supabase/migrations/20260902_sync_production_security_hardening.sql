-- QR Menu production/repository synchronization marker.
-- The underlying changes were already applied to production before this file was committed.
-- All statements are idempotent and re-assert the intended final state.

begin;

-- Product import must not invoke the legacy auto-recipe trigger implicitly.
drop trigger if exists trg_products_auto_recipe on public.products;

-- Keep the manager-facing PIN reset path available to authenticated users.
grant execute on function public.manager_reset_staff_pin(uuid, uuid, text) to authenticated;
revoke execute on function public.manager_reset_staff_pin_v2(uuid, uuid, text) from authenticated;

-- Legacy internal helpers are service-role-only.
revoke execute on function public.create_venue_for_manager_v2(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
revoke execute on function public.create_venue_from_template(text, text, text, jsonb) from public, anon, authenticated;

-- Manager authentication records must cascade when a manager is removed.
alter table public.payment_accounts drop constraint if exists payment_accounts_manager_id_fkey;
alter table public.payment_accounts
  add constraint payment_accounts_manager_id_fkey
  foreign key (manager_id) references public.profiles(id) on delete cascade;

-- Restore the canonical manager delete implementation.
create or replace function public.admin_delete_manager(p_manager_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_venues integer;
  v_auth_deleted boolean := false;
begin
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_admin;

  if not v_admin then
    raise exception 'not_authorized';
  end if;

  select count(*) into v_venues
  from public.venues
  where manager_id = p_manager_id;

  begin
    delete from auth.users where id = p_manager_id;
    v_auth_deleted := true;
  exception when others then
    raise notice 'auth.users delete skipped: %', sqlerrm;
  end;

  delete from public.profiles where id = p_manager_id;

  return jsonb_build_object(
    'ok', true,
    'manager_id', p_manager_id,
    'venues_deleted', v_venues,
    'auth_user_deleted', v_auth_deleted
  );
end;
$$;

grant execute on function public.admin_delete_manager(uuid) to authenticated, service_role;
revoke execute on function public.admin_delete_manager(uuid) from anon;

commit;
