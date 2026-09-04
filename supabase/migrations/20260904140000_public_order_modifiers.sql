begin;

create table if not exists public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_id uuid not null references public.modifiers(id) on delete restrict,
  name text not null,
  price numeric(12,2) not null default 0,
  qty integer not null default 1 check (qty > 0 and qty <= 99),
  created_at timestamptz not null default now()
);

create index if not exists idx_order_item_modifiers_item on public.order_item_modifiers(order_item_id);
create index if not exists idx_order_item_modifiers_modifier on public.order_item_modifiers(modifier_id);

alter table public.order_item_modifiers enable row level security;
revoke all on table public.order_item_modifiers from anon, authenticated;
grant select on table public.order_item_modifiers to authenticated;

drop policy if exists order_item_modifiers_manager_select on public.order_item_modifiers;
create policy order_item_modifiers_manager_select on public.order_item_modifiers
for select to authenticated using (
  exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id=oi.order_id
    join public.manager_venues mv on mv.venue_id=o.venue_id
    where oi.id=order_item_modifiers.order_item_id and mv.manager_id=(select auth.uid())
  )
  or exists (select 1 from public.profiles pr where pr.id=(select auth.uid()) and pr.role='admin')
);

create or replace function public.public_attach_order_modifiers(
  p_order_id uuid,
  p_phone text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  o public.orders%rowtype;
  item jsonb;
  selected jsonb;
  oi public.order_items%rowtype;
  mg public.modifier_groups%rowtype;
  m public.modifiers%rowtype;
  v_qty integer;
  v_group_count integer;
  v_group_total numeric;
  v_modifier_total numeric := 0;
  v_base_total numeric := 0;
  v_addon_total numeric := 0;
  v_delivery numeric := 0;
  v_total numeric := 0;
  v_free integer;
  v_chargeable integer;
begin
  select * into o from public.orders
  where id=p_order_id and customer_phone=trim(p_phone)
  for update;
  if o.id is null then raise exception 'order_not_found'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception 'modifiers_payload_invalid';
  end if;

  delete from public.order_item_modifiers where order_item_id in
    (select id from public.order_items where order_id=o.id);

  for item in select value from jsonb_array_elements(p_items) loop
    select * into oi from public.order_items
    where order_id=o.id and product_id=(item->>'product_id')::uuid
    order by id limit 1;
    if oi.id is null then raise exception 'order_item_not_found'; end if;

    if jsonb_typeof(item->'modifiers')='array' then
      for selected in select value from jsonb_array_elements(item->'modifiers') loop
        v_qty:=coalesce((selected->>'qty')::integer,0);
        if v_qty<1 or v_qty>99 then raise exception 'invalid_modifier_quantity'; end if;
        select m.* into m
        from public.modifiers m
        join public.modifier_groups g on g.id=m.modifier_group_id
        where m.id=(selected->>'modifier_id')::uuid
          and m.product_id=oi.product_id
          and m.is_active=true and g.is_active=true
        limit 1;
        if m.id is null then raise exception 'modifier_not_available'; end if;
        select * into mg from public.modifier_groups where id=m.modifier_group_id;
        insert into public.order_item_modifiers(order_item_id,modifier_id,name,price,qty)
        values(oi.id,m.id,m.name,m.price,v_qty);
        v_modifier_total:=v_modifier_total+(coalesce(m.price,0)*v_qty);
      end loop;
    end if;
  end loop;

  -- Validate each modifier group and apply free_count before charging.
  for mg in
    select mg.* from public.modifier_groups mg
    where mg.product_id in (select distinct product_id from public.order_items where order_id=o.id)
      and mg.provider='r_keeper' and mg.is_active=true
  loop
    select coalesce(sum(oim.qty),0) into v_group_count
    from public.order_item_modifiers oim
    join public.order_items oi2 on oi2.id=oim.order_item_id
    where oi2.order_id=o.id and exists(select 1 from public.modifiers mm where mm.id=oim.modifier_id and mm.modifier_group_id=mg.id);
    if mg.min_count>0 and v_group_count<mg.min_count then raise exception 'modifier_group_min_not_met'; end if;
    if mg.max_count>0 and v_group_count>mg.max_count then raise exception 'modifier_group_max_exceeded'; end if;
  end loop;

  select coalesce(sum(price*qty),0) into v_base_total from public.order_items where order_id=o.id;
  select coalesce(sum(price),0) into v_addon_total from public.order_addons where order_id=o.id;
  v_delivery:=coalesce(o.delivery_fee,0);
  v_total:=v_base_total+v_addon_total+v_modifier_total+v_delivery;

  update public.orders
  set total_price=v_total,
      items=coalesce(items,'[]'::jsonb) || jsonb_build_object('_modifiers_attached',true)
  where id=o.id;

  return jsonb_build_object('ok',true,'order_id',o.id,'modifier_total',v_modifier_total,'total_price',v_total);
exception when others then
  raise;
end;
$$;

revoke all on function public.public_attach_order_modifiers(uuid,text,jsonb) from public;
grant execute on function public.public_attach_order_modifiers(uuid,text,jsonb) to anon,authenticated;

commit;
