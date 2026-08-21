create or replace function public.create_venue_from_template(p_template_id text,p_name text,p_slug text,p_plan text default 'start',p_subscription_end timestamptz default null)
returns public.venues language plpgsql security definer set search_path=public as $$
declare v_user_id uuid:=auth.uid(); v_role text; v_template public.menu_templates; v_venue public.venues;
begin
 if v_user_id is null then raise exception 'not_authenticated'; end if;
 select role into v_role from public.profiles where id=v_user_id;
 if v_role not in('manager','admin') then raise exception 'not_allowed'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'venue_name_required'; end if;
 if nullif(trim(p_slug),'') is null then raise exception 'venue_slug_required'; end if;
 if exists(select 1 from public.venues where lower(slug)=lower(trim(p_slug))) then raise exception 'slug_exists'; end if;
 select * into v_template from public.menu_templates where id=p_template_id and is_active=true;
 if not found then raise exception 'template_not_found'; end if;
 insert into public.venues(name,slug,status,plan,subscription_end) values(trim(p_name),lower(trim(p_slug)),'active',coalesce(nullif(trim(p_plan),''),'start'),p_subscription_end) returning * into v_venue;
 insert into public.manager_venues(manager_id,venue_id) values(v_user_id,v_venue.id) on conflict do nothing;
 insert into public.manager_venue_permissions(manager_id,venue_id,can_edit_menu,can_edit_prices) values(v_user_id,v_venue.id,true,true) on conflict do nothing;
 insert into public.subscriptions(venue_id,plan_id,status,current_period_end) values(v_venue.id,coalesce(nullif(trim(p_plan),''),'start'),'trialing',p_subscription_end);
 insert into public.products(venue_id,name,description,price,category,image_url,applies_to,is_available)
 select v_venue.id,p.name,p.description,p.price,p.category,p.image_url,p.applies_to,p.is_available from public.menu_template_products p where p.template_id=v_template.id and p.is_available=true order by p.sort_order,p.name;
 return v_venue;
end; $$;
revoke execute on function public.create_venue_from_template(text,text,text,text,timestamptz) from anon,public;
grant execute on function public.create_venue_from_template(text,text,text,text,timestamptz) to authenticated;

-- Compatibility bridge for the existing manager.html, which still submits the selected
-- template's product JSON. When it exactly matches a published template, the server resolves
-- the canonical normalized catalog instead of trusting browser-supplied prices/images.
create or replace function public.create_venue_for_manager(p_name text,p_slug text,p_plan text,p_subscription_end timestamptz,p_products jsonb)
returns public.venues language plpgsql security definer set search_path=public as $$
declare v public.venues; v_template_id text;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and role in('manager','admin')) then raise exception 'not_allowed'; end if;
 if exists(select 1 from public.venues where lower(slug)=lower(trim(p_slug))) then raise exception 'slug_exists'; end if;
 select t.id into v_template_id from public.menu_templates t where t.is_active=true and t.products=coalesce(p_products,'[]'::jsonb) order by t.sort_order limit 1;
 insert into public.venues(name,slug,status,plan,subscription_end) values(trim(p_name),lower(trim(p_slug)),'active',coalesce(p_plan,'start'),p_subscription_end) returning * into v;
 insert into public.manager_venues(manager_id,venue_id) values(auth.uid(),v.id) on conflict do nothing;
 insert into public.manager_venue_permissions(manager_id,venue_id,can_edit_menu,can_edit_prices) values(auth.uid(),v.id,true,true) on conflict do nothing;
 insert into public.subscriptions(venue_id,plan_id,status,current_period_end) values(v.id,coalesce(p_plan,'start'),'trialing',p_subscription_end);
 if v_template_id is not null then
   insert into public.products(venue_id,name,description,price,category,image_url,applies_to,is_available)
   select v.id,p.name,p.description,p.price,p.category,p.image_url,p.applies_to,p.is_available from public.menu_template_products p where p.template_id=v_template_id and p.is_available=true order by p.sort_order,p.name;
 else
   insert into public.products(venue_id,name,description,price,category,image_url,applies_to,is_available)
   select v.id,x.name,x.description,coalesce(x.price,0),coalesce(x.category,'main'),x.image_url,coalesce(x.applies_to,'all'),coalesce(x.is_available,true)
   from jsonb_to_recordset(coalesce(p_products,'[]'::jsonb)) as x(name text,description text,price numeric,category text,image_url text,applies_to text,is_available boolean);
 end if;
 return v;
end; $$;
