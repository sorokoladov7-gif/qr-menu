create or replace function public.admin_save_menu_template(
  p_id text,p_name text,p_slug text,p_emoji text,p_description text,p_is_active boolean,
  p_sort_order integer,p_niche text,p_scale_code text,p_target_product_count integer,p_products jsonb
)
returns public.menu_templates
language plpgsql
security invoker
set search_path=public
as $$
declare v public.menu_templates;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'not_allowed'; end if;
  insert into public.menu_templates(id,name,slug,emoji,description,is_active,sort_order,niche,scale_code,target_product_count,products)
  values(p_id,trim(p_name),lower(trim(p_slug)),coalesce(nullif(p_emoji,''),'🍽️'),nullif(trim(p_description),''),coalesce(p_is_active,true),coalesce(p_sort_order,100),coalesce(nullif(trim(p_niche),''),'other'),coalesce(nullif(trim(p_scale_code),''),'M'),greatest(coalesce(p_target_product_count,0),0),coalesce(p_products,'[]'::jsonb))
  on conflict(id) do update set name=excluded.name,slug=excluded.slug,emoji=excluded.emoji,description=excluded.description,is_active=excluded.is_active,sort_order=excluded.sort_order,niche=excluded.niche,scale_code=excluded.scale_code,target_product_count=excluded.target_product_count,products=excluded.products,updated_at=now()
  returning * into v;
  delete from public.menu_template_products where template_id=v.id;
  delete from public.menu_template_categories where template_id=v.id;
  insert into public.menu_template_categories(template_id,name,slug,sort_order)
  select v.id,case coalesce(x.value->>'category','main') when 'main' then 'Основные блюда' when 'drink' then 'Напитки' when 'dessert' then 'Десерты' when 'snack' then 'Закуски' when 'soup' then 'Супы' when 'salad' then 'Салаты' when 'hot' then 'Горячие блюда' when 'bbq' then 'Гриль' when 'addon' then 'Дополнения' else initcap(coalesce(x.value->>'category','main')) end,coalesce(x.value->>'category','main'),min(x.ord::int)
  from jsonb_array_elements(coalesce(p_products,'[]'::jsonb)) with ordinality x(value,ord)
  group by coalesce(x.value->>'category','main') order by min(x.ord::int);
  insert into public.menu_template_products(template_id,category_id,name,description,price,category,image_url,applies_to,is_available,sort_order)
  select v.id,c.id,x.value->>'name',x.value->>'description',coalesce((x.value->>'price')::numeric,0),coalesce(x.value->>'category','main'),x.value->>'image_url',coalesce(x.value->>'applies_to','all'),coalesce((x.value->>'is_available')::boolean,true),x.ord::int
  from jsonb_array_elements(coalesce(p_products,'[]'::jsonb)) with ordinality x(value,ord)
  left join public.menu_template_categories c on c.template_id=v.id and c.slug=coalesce(x.value->>'category','main');
  return v;
end;
$$;
revoke execute on function public.admin_save_menu_template(text,text,text,text,text,boolean,integer,text,text,integer,jsonb) from anon,public;
grant execute on function public.admin_save_menu_template(text,text,text,text,text,boolean,integer,text,text,integer,jsonb) to authenticated;

create or replace function public.admin_delete_menu_template(p_id text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'not_allowed'; end if;
  delete from public.menu_templates where id=p_id;
end;
$$;
revoke execute on function public.admin_delete_menu_template(text) from anon,public;
grant execute on function public.admin_delete_menu_template(text) to authenticated;
