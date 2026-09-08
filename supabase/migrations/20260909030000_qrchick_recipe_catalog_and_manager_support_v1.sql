begin;

create or replace function public.manager_recipe_catalog_for_venue(
  p_venue_id uuid,
  p_product_names text[] default '{}',
  p_limit integer default 80
)
returns table(recipe_id uuid,recipe_name text,category text,description text,yield_quantity numeric,yield_unit text,cuisine text,difficulty text,base_servings numeric,prep_minutes integer,cook_minutes integer,nutrition_per_serving jsonb,steps jsonb,photo jsonb,source text,source_url text,source_attribution text,matched_product_name text,ingredients jsonb)
language plpgsql security definer set search_path=public as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.venue_managers vm where vm.venue_id=v.id and vm.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query with candidates as (
    select r.*,pn.name as matched_product_name,row_number() over(partition by r.id order by case when public.recipe_norm(r.name)=public.recipe_norm(pn.name) then 0 else 1 end,pn.name) rn
    from public.global_recipe_catalog r
    join lateral(select n as name from unnest(coalesce(p_product_names,'{}'::text[])) q(n) where public.recipe_norm(r.name)=public.recipe_norm(n) or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(n)) or public.recipe_norm(r.name) like '%'||public.recipe_norm(n)||'%' or public.recipe_norm(n) like '%'||public.recipe_norm(r.name)||'%' order by case when public.recipe_norm(r.name)=public.recipe_norm(n) then 0 else 1 end,n limit 1) pn on true
    where coalesce(r.is_active,true)
  ),chosen as(select * from candidates where rn=1 order by recipe_name limit greatest(1,least(coalesce(p_limit,80),200)))
  select c.id,c.name,c.category,c.description,c.yield_quantity,c.yield_unit,c.cuisine,c.difficulty,c.base_servings,c.prep_minutes,c.cook_minutes,c.nutrition_per_serving,c.steps,c.photo,c.source,c.source_url,c.source_attribution,c.matched_product_name,coalesce((select jsonb_agg(jsonb_build_object('ingredient_id',i.ingredient_id,'name',g.name,'unit',i.unit,'quantity',i.quantity,'note',i.note) order by i.sort_order) from public.global_recipe_catalog_items i join public.global_ingredient_catalog g on g.id=i.ingredient_id where i.recipe_id=c.id and coalesce(g.is_active,true)),'[]'::jsonb)
  from chosen c;
end; $$;
grant execute on function public.manager_recipe_catalog_for_venue(uuid,text[],integer) to authenticated;

create or replace function public.manager_ingredient_catalog_for_venue(p_venue_id uuid,p_product_names text[] default '{}',p_limit integer default 160)
returns table(id uuid,name text,unit text,category text,aliases text[],is_active boolean,source text,source_url text,source_attribution text,matched_recipe_name text)
language plpgsql security definer set search_path=public as $$
declare v_allowed boolean;
begin
  select exists(select 1 from public.venues v join public.profiles p on p.id=auth.uid() where v.id=p_venue_id and (p.role='admin' or exists(select 1 from public.venue_managers vm where vm.venue_id=v.id and vm.manager_id=auth.uid()))) into v_allowed;
  if not v_allowed then raise exception 'VENUE_ACCESS_DENIED' using errcode='42501'; end if;
  return query with matched_recipes as(
    select r.id,r.name from public.global_recipe_catalog r where coalesce(r.is_active,true) and exists(select 1 from unnest(coalesce(p_product_names,'{}'::text[])) q(n) where public.recipe_norm(r.name)=public.recipe_norm(q.n) or exists(select 1 from unnest(coalesce(r.aliases,'{}'::text[])) a where public.recipe_norm(a)=public.recipe_norm(q.n)) or public.recipe_norm(r.name) like '%'||public.recipe_norm(q.n)||'%' or public.recipe_norm(q.n) like '%'||public.recipe_norm(r.name)||'%') order by r.name limit greatest(1,least(coalesce(p_limit,160),300)))
  select g.id,g.name,g.unit,g.category,g.aliases,g.is_active,g.source,g.source_url,g.source_attribution,min(mr.name) filter(where mr.name is not null)
  from public.global_ingredient_catalog g join public.global_recipe_catalog_items ri on ri.ingredient_id=g.id join matched_recipes mr on mr.id=ri.recipe_id where coalesce(g.is_active,true)
  group by g.id,g.name,g.unit,g.category,g.aliases,g.is_active,g.source,g.source_url,g.source_attribution order by g.name limit greatest(1,least(coalesce(p_limit,160),300));
end; $$;
grant execute on function public.manager_ingredient_catalog_for_venue(uuid,text[],integer) to authenticated;

create table if not exists public.manager_support_threads(id uuid primary key default gen_random_uuid(),manager_id uuid not null references public.profiles(id) on delete cascade,venue_id uuid references public.venues(id) on delete set null,subject text not null default 'Поддержка',status text not null default 'open' check(status in('open','in_progress','closed')),last_message_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.manager_support_messages(id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.manager_support_threads(id) on delete cascade,sender_id uuid not null references public.profiles(id) on delete cascade,sender_role text not null check(sender_role in('manager','admin')),message text not null,created_at timestamptz not null default now(),read_at timestamptz);
create index if not exists manager_support_threads_manager_idx on public.manager_support_threads(manager_id,last_message_at desc);
create index if not exists manager_support_threads_admin_idx on public.manager_support_threads(status,last_message_at desc);
create index if not exists manager_support_messages_thread_idx on public.manager_support_messages(thread_id,created_at);
alter table public.manager_support_threads enable row level security;
alter table public.manager_support_messages enable row level security;
drop policy if exists manager_support_threads_manager on public.manager_support_threads;
drop policy if exists manager_support_threads_admin on public.manager_support_threads;
drop policy if exists manager_support_messages_manager on public.manager_support_messages;
drop policy if exists manager_support_messages_manager_insert on public.manager_support_messages;
drop policy if exists manager_support_messages_admin on public.manager_support_messages;
create policy manager_support_threads_manager on public.manager_support_threads for all to authenticated using(manager_id=auth.uid()) with check(manager_id=auth.uid());
create policy manager_support_threads_admin on public.manager_support_threads for all to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy manager_support_messages_manager on public.manager_support_messages for select to authenticated using(exists(select 1 from public.manager_support_threads t where t.id=thread_id and t.manager_id=auth.uid()));
create policy manager_support_messages_manager_insert on public.manager_support_messages for insert to authenticated with check(sender_id=auth.uid() and sender_role='manager' and exists(select 1 from public.manager_support_threads t where t.id=thread_id and t.manager_id=auth.uid()));
create policy manager_support_messages_admin on public.manager_support_messages for all to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.manager_support_get_or_create_thread(p_venue_id uuid default null,p_subject text default 'Поддержка платформы') returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager') then raise exception 'MANAGER_ONLY' using errcode='42501'; end if; select id into v_id from public.manager_support_threads where manager_id=auth.uid() and status<>'closed' order by last_message_at desc limit 1; if v_id is null then insert into public.manager_support_threads(manager_id,venue_id,subject) values(auth.uid(),p_venue_id,coalesce(nullif(trim(p_subject),''),'Поддержка платформы')) returning id into v_id; end if; return v_id; end; $$;
grant execute on function public.manager_support_get_or_create_thread(uuid,text) to authenticated;

create or replace function public.manager_support_send(p_thread_id uuid,p_message text) returns public.manager_support_messages language plpgsql security definer set search_path=public as $$ declare v_row public.manager_support_messages; begin if length(trim(coalesce(p_message,'')))=0 then raise exception 'MESSAGE_REQUIRED'; end if; if exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='manager') then if not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id and t.manager_id=auth.uid()) then raise exception 'THREAD_ACCESS_DENIED' using errcode='42501'; end if; insert into public.manager_support_messages(thread_id,sender_id,sender_role,message) values(p_thread_id,auth.uid(),'manager',left(trim(p_message),8000)) returning * into v_row; update public.manager_support_threads set last_message_at=now(),updated_at=now(),status='open' where id=p_thread_id; return v_row; end if; if exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then if not exists(select 1 from public.manager_support_threads t where t.id=p_thread_id) then raise exception 'THREAD_NOT_FOUND'; end if; insert into public.manager_support_messages(thread_id,sender_id,sender_role,message) values(p_thread_id,auth.uid(),'admin',left(trim(p_message),8000)) returning * into v_row; update public.manager_support_threads set last_message_at=now(),updated_at=now(),status='in_progress' where id=p_thread_id; return v_row; end if; raise exception 'ROLE_FORBIDDEN' using errcode='42501'; end; $$;
grant execute on function public.manager_support_send(uuid,text) to authenticated;

commit;
