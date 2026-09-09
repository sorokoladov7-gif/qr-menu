-- QRChick ingredient matching v2: broader candidate retrieval while preserving the canonical RPC signature.
create or replace function public.manager_ingredient_catalog_for_venue_v2(
  p_venue_id uuid,p_product_names text[] default '{}',p_limit integer default 160
) returns table(id uuid,name text,unit text,category text,aliases text[],is_active boolean,source text,source_url text,source_attribution text,matched_recipe_name text)
language plpgsql security definer set search_path=public as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.manager_venues mv where mv.venue_id=v.id and mv.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query
  with product_names as (
    select distinct trim(n) name from unnest(coalesce(p_product_names,'{}')) q(n) where trim(coalesce(n,''))<>''
  ), scored as (
    select g,r.name matched_recipe_name,
      (case when exists(select 1 from product_names pn where public.recipe_norm(g.name)=public.recipe_norm(pn.name)) then 100 else 0 end +
       case when exists(select 1 from product_names pn where exists(select 1 from unnest(coalesce(g.aliases,'{}')) a where public.recipe_norm(a)=public.recipe_norm(pn.name))) then 85 else 0 end +
       8*(select count(*) from product_names pn cross join lateral regexp_split_to_table(public.recipe_norm(pn.name),' ') w where length(w)>=3 and (public.recipe_norm(g.name) like '%'||w||'%' or exists(select 1 from unnest(coalesce(g.aliases,'{}')) a where public.recipe_norm(a) like '%'||w||'%'))) +
       case when r.name is not null then 15 else 0 end) score
    from public.global_ingredient_catalog g
    left join lateral (
      select r.name
      from public.global_recipe_catalog_items ri
      join public.global_recipe_catalog r on r.id=ri.recipe_id and coalesce(r.is_active,true)
      join product_names pn on public.recipe_norm(r.name) like '%'||public.recipe_norm(pn.name)||'%' or public.recipe_norm(pn.name) like '%'||public.recipe_norm(r.name)||'%'
      where ri.ingredient_id=g.id order by r.name limit 1
    ) r on true
    where coalesce(g.is_active,true)
      and not exists(select 1 from public.manager_ingredient_catalog_hidden h where h.venue_id=p_venue_id and h.ingredient_id=g.id)
  )
  select s.g.id,s.g.name,s.g.unit,s.g.category,s.g.aliases,s.g.is_active,s.g.source,s.g.source_url,s.g.source_attribution,s.matched_recipe_name
  from scored s where s.score>0 order by s.score desc,s.g.name limit greatest(1,least(coalesce(p_limit,160),300));
end;
$$;
revoke all on function public.manager_ingredient_catalog_for_venue_v2(uuid,text[],integer) from public,anon;
grant execute on function public.manager_ingredient_catalog_for_venue_v2(uuid,text[],integer) to authenticated;

create or replace function public.manager_ingredient_catalog_for_venue(uuid,text[],integer)
returns table(id uuid,name text,unit text,category text,aliases text[],is_active boolean,source text,source_url text,source_attribution text,matched_recipe_name text)
language plpgsql security definer set search_path=public as $$
begin return query select * from public.manager_ingredient_catalog_for_venue_v2($1,$2,$3); end;
$$;
revoke all on function public.manager_ingredient_catalog_for_venue(uuid,text[],integer) from public,anon;
grant execute on function public.manager_ingredient_catalog_for_venue(uuid,text[],integer) to authenticated;
