begin;

drop function if exists public.manager_recipe_catalog_for_venue(uuid,text[],integer);

create function public.manager_recipe_catalog_for_venue(
  p_venue_id uuid,
  p_product_names text[] default '{}',
  p_limit integer default 80
)
returns table(
  recipe_id uuid,
  recipe_name text,
  category text,
  description text,
  yield_quantity numeric,
  yield_unit text,
  cuisine text,
  difficulty text,
  base_servings numeric,
  prep_minutes integer,
  cook_minutes integer,
  nutrition_per_serving jsonb,
  steps jsonb,
  photo jsonb,
  source text,
  source_url text,
  source_attribution text,
  matched_product_name text,
  technology text,
  equipment text,
  cooking_temperature_c numeric,
  finishing_temperature_c numeric,
  holding_temperature_c numeric,
  storage_temperature_c numeric,
  storage_hours integer,
  shelf_life_hours integer,
  serving_temperature_c numeric,
  serving_description text,
  plating_description text,
  quality_requirements text,
  allergen_notes text,
  tech_card_version integer,
  ingredients jsonb
)
language plpgsql
security definer
set search_path = public
as $function$
declare v_allowed boolean;
begin
  select exists(
    select 1 from public.venues v
    join public.profiles p on p.id=auth.uid()
    where v.id=p_venue_id
      and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))
  ) into v_allowed;
  if not v_allowed then
    raise exception 'VENUE_ACCESS_DENIED' using errcode='42501';
  end if;

  return query
  with product_names as (
    select distinct trim(n) name
    from unnest(coalesce(p_product_names,'{}'::text[])) q(n)
    where trim(coalesce(n,''))<>''
  ),
  candidates as (
    select r.*,pn.name matched_product_name,
      row_number() over(
        partition by r.id
        order by case
          when public.recipe_norm(r.name)=public.recipe_norm(pn.name) then 0
          when exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(pn.name)) then 1
          else 2 end,
          pn.name
      ) rn
    from public.global_recipe_catalog r
    join product_names pn on (
      public.recipe_norm(r.name)=public.recipe_norm(pn.name)
      or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(pn.name))
      or public.recipe_norm(r.name) like '%'||public.recipe_norm(pn.name)||'%'
      or public.recipe_norm(pn.name) like '%'||public.recipe_norm(r.name)||'%'
    )
    where coalesce(r.is_active,true)
      and not exists(select 1 from public.manager_recipe_catalog_hidden h where h.venue_id=p_venue_id and h.recipe_id=r.id)
  ),
  chosen as (
    select * from candidates where rn=1
    order by recipe_name
    limit greatest(1,least(coalesce(p_limit,80),200))
  )
  select
    c.id,c.name,c.category,c.description,c.yield_quantity,c.yield_unit,c.cuisine,c.difficulty,
    c.base_servings,c.prep_minutes,c.cook_minutes,c.nutrition_per_serving,c.steps,c.photo,c.source,
    c.source_url,c.source_attribution,c.matched_product_name,c.technology,c.equipment,
    c.cooking_temperature_c,c.finishing_temperature_c,c.holding_temperature_c,c.storage_temperature_c,
    c.storage_hours,c.shelf_life_hours,c.serving_temperature_c,c.serving_description,c.plating_description,
    c.quality_requirements,c.allergen_notes,c.tech_card_version,
    coalesce((select jsonb_agg(jsonb_build_object(
      'ingredient_id',i.ingredient_id,
      'name',g.name,
      'unit',i.unit,
      'quantity',i.quantity,
      'gross_quantity',i.gross_quantity,
      'net_quantity',coalesce(i.net_quantity,i.quantity),
      'loss_percent',coalesce(i.loss_percent,0),
      'note',i.note,
      'preparation_note',i.preparation_note
    ) order by i.sort_order)
      from public.global_recipe_catalog_items i
      join public.global_ingredient_catalog g on g.id=i.ingredient_id
      where i.recipe_id=c.id
        and coalesce(g.is_active,true)
        and not exists(select 1 from public.manager_ingredient_catalog_hidden h where h.venue_id=p_venue_id and h.ingredient_id=g.id)
    ),'[]'::jsonb)
  from chosen c;
end;
$function$;

revoke all on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) from public;
grant execute on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) to authenticated,service_role;

commit;
