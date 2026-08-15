-- QR Menu production hardening
-- Apply through Supabase migrations. This file documents the security changes
-- already applied to the connected project.

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

create or replace function public.is_manager_of(p_venue_id uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.manager_venues mv where mv.venue_id=p_venue_id and mv.manager_id=auth.uid());
$$;

create or replace function public.create_venue_for_manager(
  p_name text,p_slug text,p_plan text,p_subscription_end timestamptz,p_products jsonb
) returns public.venues
language plpgsql security definer set search_path=public as $$
declare v public.venues;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and role in ('manager','admin')) then raise exception 'not_allowed'; end if;
  if exists(select 1 from public.venues where lower(slug)=lower(trim(p_slug))) then raise exception 'slug_exists'; end if;
  insert into public.venues(name,slug,status,plan,subscription_end)
    values(trim(p_name),lower(trim(p_slug)),'active',coalesce(p_plan,'start'),p_subscription_end)
    returning * into v;
  insert into public.manager_venues(manager_id,venue_id) values(auth.uid(),v.id) on conflict do nothing;
  insert into public.subscriptions(venue_id,plan_id,status,current_period_end)
    values(v.id,coalesce(p_plan,'start'),'trialing',p_subscription_end);
  if jsonb_typeof(coalesce(p_products,'[]'::jsonb))='array' then
    insert into public.products(venue_id,name,description,price,category,image_url,applies_to,is_available)
    select v.id,x.name,x.description,coalesce(x.price,0),coalesce(x.category,'main'),x.image_url,
           coalesce(x.applies_to,'all'),coalesce(x.is_available,true)
    from jsonb_to_recordset(p_products) as x(
      name text,description text,price numeric,category text,image_url text,applies_to text,is_available boolean
    );
  end if;
  return v;
end;
$$;
revoke all on function public.create_venue_for_manager(text,text,text,timestamptz,jsonb) from public;
grant execute on function public.create_venue_for_manager(text,text,text,timestamptz,jsonb) to authenticated;

alter table public.modifiers enable row level security;
alter table public.payment_requests enable row level security;

drop policy if exists modifiers_staff_write on public.modifiers;
create policy modifiers_staff_write on public.modifiers for all to authenticated
using (public.is_admin() or exists(select 1 from public.products pr where pr.id=modifiers.product_id and public.is_manager_of(pr.venue_id)))
with check (public.is_admin() or exists(select 1 from public.products pr where pr.id=modifiers.product_id and public.is_manager_of(pr.venue_id)));

drop policy if exists payreq_admin_update on public.payment_requests;
drop policy if exists payreq_insert on public.payment_requests;
drop policy if exists payreq_staff_read on public.payment_requests;
create policy payreq_manager_admin_read on public.payment_requests for select to authenticated using(public.is_admin() or public.is_manager_of(venue_id));
create policy payreq_manager_admin_insert on public.payment_requests for insert to authenticated with check(public.is_admin() or public.is_manager_of(venue_id));
create policy payreq_admin_update on public.payment_requests for update to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.staff_login(p_role text,p_slug text,p_pin text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text; v_slug text; v_staff_id uuid; v_phone text;
begin
  if p_role not in ('cook','courier','waiter') then raise exception 'invalid_role'; end if;
  select id,slug into v_id,v_slug from public.venues where lower(slug)=lower(trim(p_slug)) limit 1;
  if v_id is null then raise exception 'invalid_credentials'; end if;
  if p_role='cook' then
    select id,name into v_staff_id,v_name from public.cooks where venue_id=v_id and pin=trim(p_pin) limit 1;
  elsif p_role='courier' then
    select id,name,phone into v_staff_id,v_name,v_phone from public.couriers where venue_id=v_id and pin=trim(p_pin) limit 1;
  else
    select id,name,phone into v_staff_id,v_name,v_phone from public.waiters where venue_id=v_id and pin=trim(p_pin) limit 1;
  end if;
  if v_staff_id is null then raise exception 'invalid_credentials'; end if;
  if p_role='cook' then update public.cooks set last_login_at=now() where id=v_staff_id;
  elsif p_role='courier' then update public.couriers set last_login_at=now() where id=v_staff_id;
  else update public.waiters set last_login_at=now() where id=v_staff_id; end if;
  return jsonb_build_object('role',p_role,'staff_id',v_staff_id,'venue_id',v_id,'venue_slug',v_slug,
    'venue_name',(select name from public.venues where id=v_id),'staff_name',v_name,'phone',v_phone);
end;
$$;
revoke all on function public.staff_login(text,text,text) from public;
grant execute on function public.staff_login(text,text,text) to anon,authenticated;

create or replace function public.staff_update_order(p_role text,p_slug text,p_pin text,p_order_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s jsonb; v_id uuid; v_staff text; v_order public.orders;
begin
  s:=public.staff_login(p_role,p_slug,p_pin); v_id:=(s->>'venue_id')::uuid; v_staff:=s->>'staff_name';
  if p_status not in ('new','cooking','ready','delivery','done','cancelled') then raise exception 'invalid_status'; end if;
  select * into v_order from public.orders where id=p_order_id and venue_id=v_id for update;
  if v_order.id is null then raise exception 'order_not_found'; end if;
  if p_role='cook' and p_status in ('cooking','ready') then
    update public.orders set status=p_status,cook_name=v_staff,
      cooking_started_at=case when p_status='cooking' then coalesce(cooking_started_at,now()) else cooking_started_at end,
      ready_at=case when p_status='ready' then now() else ready_at end,updated_at=now() where id=p_order_id;
  elsif p_role='courier' and p_status in ('delivery','done') then
    update public.orders set status=p_status,courier_name=v_staff,updated_at=now() where id=p_order_id;
  elsif p_role='waiter' and p_status in ('done','cancelled') then
    update public.orders set status=p_status,waiter_name=v_staff,updated_at=now() where id=p_order_id;
  else raise exception 'role_status_not_allowed'; end if;
  return jsonb_build_object('ok',true,'order_id',p_order_id,'status',p_status,'staff_name',v_staff);
end;
$$;
revoke all on function public.staff_update_order(text,text,text,uuid,text) from public;
grant execute on function public.staff_update_order(text,text,text,uuid,text) to anon,authenticated;

drop policy if exists cooks_public_read on public.cooks;
drop policy if exists cooks_public_login_update on public.cooks;
drop policy if exists couriers_public_read on public.couriers;
drop policy if exists couriers_public_login_update on public.couriers;
drop policy if exists waiters_public_read on public.waiters;
drop policy if exists waiters_public_login_update on public.waiters;
drop policy if exists "anon update orders" on public.orders;
drop policy if exists "auth update orders" on public.orders;
