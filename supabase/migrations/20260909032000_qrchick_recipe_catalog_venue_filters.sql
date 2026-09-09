begin;

create table if not exists public.manager_recipe_catalog_hidden (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  recipe_id uuid not null references public.global_recipe_catalog(id) on delete cascade,
  hidden_by uuid references public.profiles(id) on delete set null,
  hidden_at timestamptz not null default now(),
  unique (venue_id, recipe_id)
);

create table if not exists public.manager_ingredient_catalog_hidden (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  ingredient_id uuid not null references public.global_ingredient_catalog(id) on delete cascade,
  hidden_by uuid references public.profiles(id) on delete set null,
  hidden_at timestamptz not null default now(),
  unique (venue_id, ingredient_id)
);

create index if not exists idx_manager_recipe_catalog_hidden_venue on public.manager_recipe_catalog_hidden(venue_id);
create index if not exists idx_manager_recipe_catalog_hidden_recipe on public.manager_recipe_catalog_hidden(recipe_id);
create index if not exists idx_manager_ingredient_catalog_hidden_venue on public.manager_ingredient_catalog_hidden(venue_id);
create index if not exists idx_manager_ingredient_catalog_hidden_ingredient on public.manager_ingredient_catalog_hidden(ingredient_id);

alter table public.manager_recipe_catalog_hidden enable row level security;
alter table public.manager_ingredient_catalog_hidden enable row level security;

create or replace function public.manager_recipe_catalog_hide_for_venue(p_venue_id uuid,p_recipe_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  insert into public.manager_recipe_catalog_hidden(venue_id,recipe_id,hidden_by)
  values(p_venue_id,p_recipe_id,auth.uid())
  on conflict(venue_id,recipe_id) do update set hidden_by=excluded.hidden_by,hidden_at=now();
  return true;
end;
$$;

grant execute on function public.manager_recipe_catalog_hide_for_venue(uuid,uuid) to authenticated;

create or replace function public.manager_ingredient_catalog_hide_for_venue(p_venue_id uuid,p_ingredient_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  insert into public.manager_ingredient_catalog_hidden(venue_id,ingredient_id,hidden_by)
  values(p_venue_id,p_ingredient_id,auth.uid())
  on conflict(venue_id,ingredient_id) do update set hidden_by=excluded.hidden_by,hidden_at=now();
  return true;
end;
$$;

grant execute on function public.manager_ingredient_catalog_hide_for_venue(uuid,uuid) to authenticated;

create or replace function public.manager_recipe_catalog_for_venue(p_venue_id uuid,p_product_names text[] default '{}',p_limit integer default 80)
returns table(recipe_id uuid,recipe_name text,category text,description text,yield_quantity numeric,yield_unit text,cuisine text,difficulty text,base_servings numeric,prep_minutes integer,cook_minutes integer,nutrition_per_serving jsonb,steps jsonb,photo jsonb,source text,source_url text,source_attribution text,matched_product_name text,ingredients jsonb)
language plpgsql
security definer
set search_path=public
as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query
  with product_names as (
    select distinct trim(n) name from unnest(coalesce(p_product_names,'{}'::text[])) q(n) where trim(coalesce(n,''))<>''
  ),
  candidates as (
    select r.*,pn.name matched_product_name,
      row_number() over(partition by r.id order by case when public.recipe_norm(r.name)=public.recipe_norm(pn.name) then 0 when exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(pn.name)) then 1 else 2 end,pn.name) rn
    from public.global_recipe_catalog r
    join product_names pn on (public.recipe_norm(r.name)=public.recipe_norm(pn.name) or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(pn.name)) or public.recipe_norm(r.name) like '%'||public.recipe_norm(pn.name)||'%' or public.recipe_norm(pn.name) like '%'||public.recipe_norm(r.name)||'%')
    where coalesce(r.is_active,true)
      and not exists(select 1 from public.manager_recipe_catalog_hidden h where h.venue_id=p_venue_id and h.recipe_id=r.id)
  ),
  chosen as (select * from candidates where rn=1 order by recipe_name limit greatest(1,least(coalesce(p_limit,80),200)))
  select c.id,c.name,c.category,c.description,c.yield_quantity,c.yield_unit,c.cuisine,c.difficulty,c.base_servings,c.prep_minutes,c.cook_minutes,c.nutrition_per_serving,c.steps,c.photo,c.source,c.source_url,c.source_attribution,c.matched_product_name,
    coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',i.ingredient_id,'name',g.name,'unit',i.unit,'quantity',i.quantity,'note',i.note) order by i.sort_order)
      from public.global_recipe_catalog_items i join public.global_ingredient_catalog g on g.id=i.ingredient_id
      where i.recipe_id=c.id and coalesce(g.is_active,true)
        and not exists(select 1 from public.manager_ingredient_catalog_hidden h where h.venue_id=p_venue_id and h.ingredient_id=g.id)
    ),'[]'::jsonb)
  from chosen c;
end;
$$;

grant execute on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) to authenticated;

create or replace function public.manager_ingredient_catalog_for_venue(p_venue_id uuid,p_product_names text[] default '{}',p_limit integer default 160)
returns table(id uuid,name text,unit text,category text,aliases text[],is_active boolean,source text,source_url text,source_attribution text,matched_recipe_name text)
language plpgsql
security definer
set search_path=public
as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query
  with product_names as (select distinct trim(n) name from unnest(coalesce(p_product_names,'{}'::text[])) q(n) where trim(coalesce(n,''))<>''),
  matched_recipes as (
    select r.id,r.name from public.global_recipe_catalog r
    where coalesce(r.is_active,true)
      and not exists(select 1 from public.manager_recipe_catalog_hidden h where h.venue_id=p_venue_id and h.recipe_id=r.id)
      and exists(select 1 from product_names q where public.recipe_norm(r.name)=public.recipe_norm(q.name) or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(q.name)) or public.recipe_norm(r.name) like '%'||public.recipe_norm(q.name)||'%' or public.recipe_norm(q.name) like '%'||public.recipe_norm(r.name)||'%')
    order by r.name limit greatest(1,least(coalesce(p_limit,160),300))
  )
  select g.id,g.name,g.unit,g.category,g.aliases,g.is_active,g.source,g.source_url,g.source_attribution,min(mr.name) filter(where mr.name is not null)
  from public.global_ingredient_catalog g
  join public.global_recipe_catalog_items ri on ri.ingredient_id=g.id
  join matched_recipes mr on mr.id=ri.recipe_id
  where coalesce(g.is_active,true)
    and not exists(select 1 from public.manager_ingredient_catalog_hidden h where h.venue_id=p_venue_id and h.ingredient_id=g.id)
  group by g.id,g.name,g.unit,g.category,g.aliases,g.is_active,g.source,g.source_url,g.source_attribution
  order by g.name
  limit greatest(1,least(coalesce(p_limit,160),300));
end;
$$;

grant execute on function public.manager_ingredient_catalog_for_venue(uuid,text[],integer) to authenticated;

commit;