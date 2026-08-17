alter table public.venues add column if not exists design_settings jsonb;

update public.venues
set design_settings = coalesce(design_settings, jsonb_build_object(
  'template','default',
  'brand_color',coalesce(brand_color,'#6366f1'),
  'button_color','#8b5cf6',
  'header_color','#ffffff',
  'font_family','Plus+Jakarta+Sans',
  'hero_enabled',true,
  'hero_style','gradient',
  'card_style','glass',
  'card_radius',18,
  'button_radius',12,
  'button_style','gradient',
  'category_style','chips',
  'image_ratio','4:3'
));

create or replace function public.guard_venue_design_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.manager_permissions is distinct from old.manager_permissions then
    raise exception 'Only platform admin can change manager permissions';
  end if;
  if new.design_settings is distinct from old.design_settings
     and coalesce(old.manager_permissions->>'design','false') <> 'true' then
    raise exception 'Design access is disabled for this manager';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_venue_design_access on public.venues;
create trigger trg_guard_venue_design_access
before update on public.venues
for each row execute function public.guard_venue_design_access();

create or replace function public.manager_save_design(p_venue_id uuid, p_design_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not public.is_manager_of(p_venue_id) then raise exception 'Venue access denied'; end if;
  select manager_permissions into v from public.venues where id=p_venue_id;
  if coalesce(v->>'design','false') <> 'true' then raise exception 'Design access is disabled by platform admin'; end if;
  update public.venues set design_settings=coalesce(p_design_settings,'{}'::jsonb) where id=p_venue_id;
  return (select design_settings from public.venues where id=p_venue_id);
end;
$$;

create or replace function public.admin_set_venue_design_access(p_venue_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select coalesce(manager_permissions,'{}'::jsonb) into v from public.venues where id=p_venue_id for update;
  if not found then raise exception 'Venue not found'; end if;
  v:=jsonb_set(v,'{design}',to_jsonb(p_enabled),true);
  update public.venues set manager_permissions=v where id=p_venue_id;
  return v;
end;
$$;

revoke execute on function public.manager_save_design(uuid,jsonb) from public, anon;
grant execute on function public.manager_save_design(uuid,jsonb) to authenticated;
revoke execute on function public.admin_set_venue_design_access(uuid,boolean) from public, anon;
grant execute on function public.admin_set_venue_design_access(uuid,boolean) to authenticated;
