-- Keep the existing RPC contract for all current manager/cook clients.
create or replace function public.manager_recipe_catalog_for_venue(
  p_venue_id uuid,
  p_product_names text[] default '{}',
  p_limit integer default 80
) returns table(
  recipe_id uuid,recipe_name text,category text,description text,yield_quantity numeric,yield_unit text,cuisine text,difficulty text,
  base_servings numeric,prep_minutes integer,cook_minutes integer,nutrition_per_serving jsonb,steps jsonb,photo jsonb,source text,
  source_url text,source_attribution text,matched_product_name text,technology text,equipment text,cooking_temperature_c numeric,
  finishing_temperature_c numeric,holding_temperature_c numeric,storage_temperature_c numeric,storage_hours integer,shelf_life_hours integer,
  serving_temperature_c numeric,serving_description text,plating_description text,quality_requirements text,allergen_notes text,
  tech_card_version integer,ingredients jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select * from public.manager_recipe_catalog_for_venue_v2(p_venue_id,p_product_names,p_limit);
end;
$$;
revoke all on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) from public,anon;
grant execute on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) to authenticated;
