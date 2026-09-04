create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  provider text not null default 'manual',
  external_id text,
  name text not null,
  min_count integer not null default 0 check (min_count >= 0),
  max_count integer not null default 0 check (max_count >= 0),
  free_count integer not null default 0 check (free_count >= 0),
  changes_price boolean not null default false,
  default_modifier_external_id text,
  replace_default_modifier boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.modifiers add column if not exists modifier_group_id uuid references public.modifier_groups(id) on delete cascade;
alter table public.modifiers add column if not exists provider text not null default 'manual';
alter table public.modifiers add column if not exists external_id text;
alter table public.modifiers add column if not exists external_dish_id text;
alter table public.modifiers add column if not exists image_url text;
alter table public.modifiers add column if not exists max_one_dish integer not null default 0;
alter table public.modifiers add column if not exists is_active boolean not null default true;
alter table public.modifiers add column if not exists sort_order integer not null default 0;
alter table public.modifiers add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.product_combo_components (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  provider text not null default 'manual',
  external_id text,
  name text not null,
  price numeric not null default 0,
  quantity numeric not null default 1 check (quantity > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_modifier_groups_provider_external on public.modifier_groups(product_id,provider,external_id) where external_id is not null;
create unique index if not exists uq_modifiers_group_provider_external on public.modifiers(modifier_group_id,provider,external_id) where external_id is not null;
create unique index if not exists uq_combo_components_provider_external on public.product_combo_components(product_id,provider,external_id) where external_id is not null;
create index if not exists idx_modifier_groups_product on public.modifier_groups(product_id);
create index if not exists idx_modifiers_group on public.modifiers(modifier_group_id);
create index if not exists idx_combo_components_product on public.product_combo_components(product_id);

alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.product_combo_components enable row level security;

revoke all on table public.modifier_groups, public.modifiers, public.product_combo_components from anon, authenticated;
grant select on table public.modifier_groups, public.modifiers, public.product_combo_components to anon, authenticated;

drop policy if exists modifier_groups_manager_select on public.modifier_groups;
create policy modifier_groups_manager_select on public.modifier_groups for select to authenticated using (
  exists (select 1 from public.manager_venues mv where mv.venue_id=(select p.venue_id from public.products p where p.id=modifier_groups.product_id) and mv.manager_id=(select auth.uid()))
  or exists (select 1 from public.profiles pr where pr.id=(select auth.uid()) and pr.role='admin')
);
drop policy if exists modifier_groups_public_select on public.modifier_groups;
create policy modifier_groups_public_select on public.modifier_groups for select to anon using (
  exists (select 1 from public.products p join public.venues v on v.id=p.venue_id where p.id=modifier_groups.product_id and p.is_available=true and v.status='active')
);

drop policy if exists modifiers_manager_select on public.modifiers;
create policy modifiers_manager_select on public.modifiers for select to authenticated using (
  exists (select 1 from public.modifier_groups mg join public.products p on p.id=mg.product_id join public.manager_venues mv on mv.venue_id=p.venue_id where mg.id=modifiers.modifier_group_id and mv.manager_id=(select auth.uid()))
  or exists (select 1 from public.profiles pr where pr.id=(select auth.uid()) and pr.role='admin')
);
drop policy if exists modifiers_public_select on public.modifiers;
create policy modifiers_public_select on public.modifiers for select to anon using (
  exists (select 1 from public.modifier_groups mg join public.products p on p.id=mg.product_id join public.venues v on v.id=p.venue_id where mg.id=modifiers.modifier_group_id and p.is_available=true and v.status='active')
);

drop policy if exists combo_components_manager_select on public.product_combo_components;
create policy combo_components_manager_select on public.product_combo_components for select to authenticated using (
  exists (select 1 from public.products p join public.manager_venues mv on mv.venue_id=p.venue_id where p.id=product_combo_components.product_id and mv.manager_id=(select auth.uid()))
  or exists (select 1 from public.profiles pr where pr.id=(select auth.uid()) and pr.role='admin')
);
drop policy if exists combo_components_public_select on public.product_combo_components;
create policy combo_components_public_select on public.product_combo_components for select to anon using (
  exists (select 1 from public.products p join public.venues v on v.id=p.venue_id where p.id=product_combo_components.product_id and p.is_available=true and v.status='active')
);

create or replace function public.sync_rk_normalized_modifiers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rk jsonb;
  scheme jsonb;
  grp jsonb;
  item jsonb;
  ing jsonb;
  mg_id uuid;
  pos integer := 0;
  local_product uuid := new.local_id;
  status text := coalesce(new.external_status,'active');
begin
  if new.provider <> 'r_keeper' or new.entity_type <> 'product' or local_product is null then
    return new;
  end if;

  delete from public.modifier_groups where product_id=local_product and provider='r_keeper';
  delete from public.product_combo_components where product_id=local_product and provider='r_keeper';

  if status='missing' then
    return new;
  end if;

  rk := coalesce(new.metadata->'r_keeper','{}'::jsonb);
  if jsonb_typeof(rk->'modifiers')='array' then
    for scheme in select value from jsonb_array_elements(rk->'modifiers') loop
      if jsonb_typeof(scheme->'groups') <> 'array' then continue; end if;
      for grp in select value from jsonb_array_elements(scheme->'groups') loop
        pos := pos + 1;
        insert into public.modifier_groups(product_id,provider,external_id,name,min_count,max_count,default_modifier_external_id,replace_default_modifier,is_active,sort_order,metadata)
        values(local_product,'r_keeper',nullif(scheme->>'id','') || ':' || nullif(grp->>'id',''),coalesce(nullif(grp->>'name',''),nullif(scheme->>'name',''),'Модификаторы'),greatest(coalesce((grp->>'min_count')::integer,0),0),greatest(coalesce((grp->>'max_count')::integer,0),0),nullif(grp->>'default_modifier',''),coalesce((grp->>'replace_default_modifier')::boolean,false),coalesce((grp->>'active')::boolean,true),pos,jsonb_build_object('scheme',scheme,'source_group',grp))
        returning id into mg_id;
        for item in select value from jsonb_array_elements(coalesce(grp->'items','[]'::jsonb)) loop
          insert into public.modifiers(product_id,modifier_group_id,provider,external_id,external_dish_id,name,price,is_required,image_url,max_one_dish,is_active,sort_order,metadata)
          values(local_product,mg_id,'r_keeper',nullif(item->>'id',''),nullif(item->>'dish_id',''),coalesce(nullif(item->>'name',''),'Модификатор'),coalesce((item->>'price')::numeric,0),false,item->>'image_url',greatest(coalesce((item->>'max_one_dish')::integer,0),0),coalesce((item->>'active')::boolean,true),0,item);
        end loop;
      end loop;
    end loop;
  end if;

  if jsonb_typeof(rk->'ingredients')='array' then
    for ing in select value from jsonb_array_elements(rk->'ingredients') loop
      insert into public.product_combo_components(product_id,provider,external_id,name,price,quantity,is_active,sort_order,metadata)
      values(local_product,'r_keeper',nullif(ing->>'id',''),coalesce(nullif(ing->>'name',''),'Компонент'),coalesce((ing->>'price')::numeric,0),1,coalesce((ing->>'active')::boolean,true),coalesce((ing->>'sort_order')::integer,0),ing);
    end loop;
  end if;

  return new;
exception when others then
  raise warning 'r_keeper normalized modifier sync failed for product %: %',local_product,sqlerrm;
  return new;
end;
$$;

revoke all on function public.sync_rk_normalized_modifiers() from public;
grant execute on function public.sync_rk_normalized_modifiers() to service_role;

drop trigger if exists trg_sync_rk_normalized_modifiers on public.integration_item_mappings;
create trigger trg_sync_rk_normalized_modifiers
after insert or update of local_id,metadata,external_status on public.integration_item_mappings
for each row execute function public.sync_rk_normalized_modifiers();

insert into public.modifier_groups(product_id,provider,name,min_count,max_count,is_active,sort_order,metadata)
select m.product_id,'manual','Модификаторы',case when bool_or(m.is_required) then 1 else 0 end,0,true,0,'{"migrated_from_legacy_modifiers":true}'::jsonb
from public.modifiers m
where m.modifier_group_id is null
  and m.provider='manual'
group by m.product_id;

update public.modifiers m
set modifier_group_id=mg.id
from public.modifier_groups mg
where m.modifier_group_id is null and m.provider='manual' and mg.product_id=m.product_id and mg.provider='manual';
