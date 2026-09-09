-- QRChick recipe architecture v1: canonical manager recipe workspace + secure AI persistence.
create or replace function public.manager_tech_card_ai_create(
  p_venue_id uuid,
  p_product_id uuid,
  p_file_name text,
  p_ocr_text text,
  p_recipe_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_id uuid;
  v_title text := nullif(trim(coalesce(p_recipe_data->>'recipe_name','')), '');
begin
  if not exists (select 1 from public.manager_venues mv where mv.venue_id=p_venue_id and mv.manager_id=v_manager)
     and not exists (select 1 from public.profiles p where p.id=v_manager and p.role='admin') then
    raise exception 'forbidden';
  end if;
  if p_product_id is not null and not exists (select 1 from public.products pr where pr.id=p_product_id and pr.venue_id=p_venue_id) then
    raise exception 'product_not_found';
  end if;
  insert into public.manager_tech_cards(
    venue_id,product_id,file_name,file_path,file_url,ocr_text,status,created_by,source_type,global_recipe_id,title,recipe_data
  ) values (
    p_venue_id,p_product_id,coalesce(nullif(trim(p_file_name),''),'Техкарта'),null,null,coalesce(p_ocr_text,''),'processed',v_manager,'photo',null,
    coalesce(v_title,nullif(trim(p_file_name),''),'Техкарта'),coalesce(p_recipe_data,'{}'::jsonb)
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'product_id',p_product_id,'title',coalesce(v_title,nullif(trim(p_file_name),''),'Техкарта'));
end;
$$;

create or replace function public.manager_tech_card_update(
  p_tech_card_id uuid,
  p_title text default null,
  p_file_name text default null,
  p_recipe_data jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_manager uuid := auth.uid();
  v_id uuid;
begin
  if not exists (
    select 1 from public.manager_tech_cards tc
    where tc.id=p_tech_card_id
      and (exists(select 1 from public.manager_venues mv where mv.venue_id=tc.venue_id and mv.manager_id=v_manager)
           or exists(select 1 from public.profiles p where p.id=v_manager and p.role='admin'))
  ) then raise exception 'forbidden'; end if;
  update public.manager_tech_cards
     set title=coalesce(nullif(trim(p_title),''),title),
         file_name=coalesce(nullif(trim(p_file_name),''),file_name),
         recipe_data=coalesce(p_recipe_data,recipe_data)
   where id=p_tech_card_id
   returning id into v_id;
  return jsonb_build_object('id',v_id);
end;
$$;

revoke all on function public.manager_tech_card_ai_create(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.manager_tech_card_ai_create(uuid,uuid,text,text,jsonb) to authenticated;
revoke all on function public.manager_tech_card_update(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.manager_tech_card_update(uuid,text,text,jsonb) to authenticated;

create or replace function public.manager_recipe_catalog_for_venue_v2(
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
declare v_allowed boolean;
begin
  select exists(
    select 1 from public.venues v join public.profiles p on p.id=auth.uid()
    where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))
  ) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query
  with product_names as (
    select distinct trim(n) name from unnest(coalesce(p_product_names,'{}'::text[])) q(n) where trim(coalesce(n,''))<>''
  ),
  scored as (
    select r.*,pn.name matched_product_name,
      (
        case when public.recipe_norm(r.name)=public.recipe_norm(pn.name) then 100 else 0 end +
        case when exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(pn.name)) then 85 else 0 end +
        case when public.recipe_norm(r.name) like '%'||public.recipe_norm(pn.name)||'%' or public.recipe_norm(pn.name) like '%'||public.recipe_norm(r.name)||'%' then 65 else 0 end +
        8*(select count(*) from regexp_split_to_table(public.recipe_norm(pn.name),' ') w where length(w)>=3 and (public.recipe_norm(r.name) like '%'||w||'%' or public.recipe_norm(coalesce(r.description,'')) like '%'||w||'%')) +
        case when public.recipe_norm(coalesce(r.description,'')) like '%'||public.recipe_norm(pn.name)||'%' then 18 else 0 end +
        case when exists(
          select 1 from public.global_recipe_catalog_items ri join public.global_ingredient_catalog gi on gi.id=ri.ingredient_id
          where ri.recipe_id=r.id and coalesce(gi.is_active,true) and (
            public.recipe_norm(gi.name) like '%'||public.recipe_norm(pn.name)||'%' or
            public.recipe_norm(pn.name) like '%'||public.recipe_norm(gi.name)||'%' or
            exists(select 1 from unnest(coalesce(gi.aliases,'{}'::text[])) a where public.recipe_norm(a) like '%'||public.recipe_norm(pn.name)||'%')
          )
        ) then 25 else 0 end
      ) score
    from public.global_recipe_catalog r cross join product_names pn
    where coalesce(r.is_active,true)
      and not exists(select 1 from public.manager_recipe_catalog_hidden h where h.venue_id=p_venue_id and h.recipe_id=r.id)
  ),
  chosen as (
    select * from (
      select s.*,row_number() over(partition by s.id order by s.score desc,s.name) rn from scored s
    ) q where rn=1 order by score desc,recipe_name limit greatest(1,least(coalesce(p_limit,80),200))
  )
  select c.id,c.name,c.category,c.description,c.yield_quantity,c.yield_unit,c.cuisine,c.difficulty,c.base_servings,c.prep_minutes,c.cook_minutes,
         c.nutrition_per_serving,c.steps,c.photo,c.source,c.source_url,c.source_attribution,c.matched_product_name,c.technology,c.equipment,
         c.cooking_temperature_c,c.finishing_temperature_c,c.holding_temperature_c,c.storage_temperature_c,c.storage_hours,c.shelf_life_hours,
         c.serving_temperature_c,c.serving_description,c.plating_description,c.quality_requirements,c.allergen_notes,c.tech_card_version,
         coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',i.ingredient_id,'name',g.name,'unit',i.unit,'quantity',i.quantity,
           'gross_quantity',i.gross_quantity,'net_quantity',coalesce(i.net_quantity,i.quantity),'loss_percent',coalesce(i.loss_percent,0),
           'note',i.note,'preparation_note',i.preparation_note) order by i.sort_order)
           from public.global_recipe_catalog_items i join public.global_ingredient_catalog g on g.id=i.ingredient_id
           where i.recipe_id=c.id and coalesce(g.is_active,true)
             and not exists(select 1 from public.manager_ingredient_catalog_hidden h where h.venue_id=p_venue_id and h.ingredient_id=g.id)
         ),'[]'::jsonb)
  from chosen c;
end;
$$;

revoke all on function public.manager_recipe_catalog_for_venue_v2(uuid,text[],integer) from public,anon;
grant execute on function public.manager_recipe_catalog_for_venue_v2(uuid,text[],integer) to authenticated;
