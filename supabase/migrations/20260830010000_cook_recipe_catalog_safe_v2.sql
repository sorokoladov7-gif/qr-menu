begin;

create or replace function public.cook_recipe_sync_safe_v2(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  s public.staff_sessions;
  p record;
  g record;
  v_text text;
  v_name_norm text;
  v_candidate_count int;
  v_ingredient_id uuid;
  v_added int := 0;
  v_ambiguous int := 0;
  v_products int := 0;
  v_matches int := 0;
  v_details jsonb := '[]'::jsonb;
  v_sort int;
  v_term text;
begin
  select * into s from public.staff_sessions
  where token=p_token and expires_at>now() and staff_type='cook' limit 1;
  if s.id is null then return jsonb_build_object('success',false,'error','invalid_session'); end if;

  for p in select id,name,description from public.products
           where venue_id=s.venue_id and coalesce(category,'main')<>'addon' order by name loop
    v_products:=v_products+1;
    v_text:=public.recipe_norm(coalesce(p.name,'')||' '||coalesce(p.description,''));
    v_added:=0; v_ambiguous:=0;
    if nullif(trim(v_text),'') is null then
      v_details:=v_details||jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'added',0,'ambiguous',0,'reason','empty_text'));
      continue;
    end if;

    for g in select gi.id,gi.name,gi.unit,coalesce(gi.aliases,'{}'::text[]) aliases
             from public.global_ingredient_catalog gi where coalesce(gi.is_active,true) loop
      v_name_norm:=public.recipe_norm(g.name);
      if length(v_name_norm)<3 then continue; end if;
      if position(' '||v_name_norm||' ' in ' '||v_text||' ')=0 then
        v_term:=null;
        foreach v_term in array g.aliases loop
          if length(public.recipe_norm(v_term))>=3 and position(' '||public.recipe_norm(v_term)||' ' in ' '||v_text||' ')>0 then exit; end if;
          v_term:=null;
        end loop;
        if v_term is null then continue; end if;
      end if;

      select count(*) into v_candidate_count
      from public.ingredients i
      where i.venue_id=s.venue_id and coalesce(i.is_active,true)
        and (public.recipe_norm(i.name)=v_name_norm
          or exists(select 1 from unnest(g.aliases) a where public.recipe_norm(i.name)=public.recipe_norm(a))
          or exists(select 1 from public.ingredient_aliases ia where ia.venue_id=s.venue_id and ia.ingredient_id=i.id
                    and (public.recipe_norm(ia.alias)=v_name_norm or exists(select 1 from unnest(g.aliases) a where public.recipe_norm(ia.alias)=public.recipe_norm(a)))));

      if v_candidate_count>1 then v_ambiguous:=v_ambiguous+1; continue; end if;
      if v_candidate_count=1 then
        select i.id into v_ingredient_id from public.ingredients i
        where i.venue_id=s.venue_id and coalesce(i.is_active,true)
          and (public.recipe_norm(i.name)=v_name_norm
            or exists(select 1 from unnest(g.aliases) a where public.recipe_norm(i.name)=public.recipe_norm(a))
            or exists(select 1 from public.ingredient_aliases ia where ia.venue_id=s.venue_id and ia.ingredient_id=i.id
                      and (public.recipe_norm(ia.alias)=v_name_norm or exists(select 1 from unnest(g.aliases) a where public.recipe_norm(ia.alias)=public.recipe_norm(a))))) limit 1;
      else
        begin
          insert into public.ingredients(venue_id,name,unit,purchase_quantity,purchase_price,is_active)
          values(s.venue_id,g.name,public.recipe_local_unit(g.unit),1,0,true) returning id into v_ingredient_id;
        exception when unique_violation then
          select i.id into v_ingredient_id from public.ingredients i
          where i.venue_id=s.venue_id and coalesce(i.is_active,true) and public.recipe_norm(i.name)=v_name_norm order by i.id limit 1;
        end;
      end if;

      if v_ingredient_id is null then continue; end if;
      if not exists(select 1 from public.product_ingredients pi where pi.product_id=p.id and pi.ingredient_id=v_ingredient_id) then
        select coalesce(max(sort_order),-1)+1 into v_sort from public.product_ingredients where product_id=p.id;
        insert into public.product_ingredients(product_id,ingredient_id,quantity,sort_order,note)
        values(p.id,v_ingredient_id,1,v_sort,'Автосинхронизация v2: точное совпадение name/description/aliases') on conflict do nothing;
        if found then v_added:=v_added+1; v_matches:=v_matches+1; end if;
      end if;
    end loop;
    v_details:=v_details||jsonb_build_array(jsonb_build_object('product_id',p.id,'product_name',p.name,'added',v_added,'ambiguous',v_ambiguous));
  end loop;
  return jsonb_build_object('success',true,'venue_id',s.venue_id,'products_checked',v_products,'added',v_matches,'details',v_details);
exception when others then
  return jsonb_build_object('success',false,'error','safe_sync_failed','message',sqlerrm);
end;
$function$;

create or replace function public.cook_recipe_catalog(p_token text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $function$
declare s public.staff_sessions; sync_result jsonb; v_products jsonb;
begin
 select * into s from public.staff_sessions where token=p_token and expires_at>now() and staff_type='cook' limit 1;
 if s.id is null then return jsonb_build_object('success',false,'error','invalid_session'); end if;
 sync_result:=public.cook_recipe_sync_safe_v2(p_token);
 select coalesce(jsonb_agg(jsonb_build_object('product_id',p.id,'product_name',p.name,'description',p.description,'category',p.category,'price',p.price,'is_available',coalesce(p.is_available,true),'recipe_id',gr.id,'recipe_name',gr.name,'recipe_description',gr.description,'yield_quantity',gr.yield_quantity,'yield_unit',gr.yield_unit,'base_servings',gr.base_servings,'prep_minutes',gr.prep_minutes,'cook_minutes',gr.cook_minutes,'difficulty',gr.difficulty,'steps',coalesce(gr.steps,'[]'::jsonb),'ingredients',coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',i.id,'name',i.name,'quantity',pi.quantity,'unit',i.unit,'note',pi.note,'sort_order',pi.sort_order) order by pi.sort_order,i.name) from public.product_ingredients pi join public.ingredients i on i.id=pi.ingredient_id where pi.product_id=p.id and i.venue_id=s.venue_id and coalesce(i.is_active,true)),'[]'::jsonb),'ingredient_count',(select count(*) from public.product_ingredients pi join public.ingredients i on i.id=pi.ingredient_id where pi.product_id=p.id and i.venue_id=s.venue_id and coalesce(i.is_active,true)),'status',case when exists(select 1 from public.product_ingredients pi where pi.product_id=p.id) then 'ready' when gr.id is not null then 'recipe_not_synced' else 'missing_recipe' end) order by p.category nulls last,p.name),'[]'::jsonb) into v_products
 from public.products p left join lateral (select r.* from public.global_recipe_catalog r where r.is_active and (public.recipe_norm(r.name)=public.recipe_norm(p.name) or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(p.name))) order by case when public.recipe_norm(r.name)=public.recipe_norm(p.name) then 0 else 1 end,r.id limit 1) gr on true where p.venue_id=s.venue_id and coalesce(p.category,'main')<>'addon';
 return jsonb_build_object('success',true,'venue_id',s.venue_id,'sync',sync_result,'products',v_products);
exception when others then return jsonb_build_object('success',false,'error','recipe_catalog_failed','message',sqlerrm); end;
$function$;

revoke all on function public.cook_recipe_sync_safe_v2(text) from public,anon,authenticated;
grant execute on function public.cook_recipe_sync_safe_v2(text) to anon,authenticated;
revoke all on function public.cook_recipe_catalog(text) from public;
grant execute on function public.cook_recipe_catalog(text) to anon,authenticated;

commit;
