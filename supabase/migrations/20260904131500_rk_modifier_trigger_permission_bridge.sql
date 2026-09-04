create or replace function public.guard_modifier_permission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v uuid;
begin
  if current_setting('app.integration_sync', true) = 'r_keeper' then
    return new;
  end if;
  select venue_id into v from public.products where id=NEW.product_id;
  if is_admin() then return NEW; end if;
  if v is null or not is_manager_of(v) then raise exception 'not_authorized'; end if;
  if TG_OP='INSERT' then
    if not public.manager_has_permission(v,'edit_menu') then raise exception 'menu_permission_required'; end if;
    if NEW.price<>0 and not public.manager_has_permission(v,'edit_prices') then raise exception 'price_permission_required'; end if;
  else
    if NEW.name is distinct from OLD.name or NEW.is_required is distinct from OLD.is_required then
      if not public.manager_has_permission(v,'edit_menu') then raise exception 'menu_permission_required'; end if;
    end if;
    if NEW.price is distinct from OLD.price and not public.manager_has_permission(v,'edit_prices') then raise exception 'price_permission_required'; end if;
  end if;
  return new;
end;
$$;

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

  perform set_config('app.integration_sync','r_keeper',true);

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
end;
$$;

revoke all on function public.sync_rk_normalized_modifiers() from public;
grant execute on function public.sync_rk_normalized_modifiers() to service_role;
