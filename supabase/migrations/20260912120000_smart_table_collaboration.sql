begin;

-- Smart Table 2.0: table context, guest service requests, shared cart and split-ready guest identities.
alter table public.venue_tables
  add column if not exists hall_name text,
  add column if not exists assigned_waiter_id uuid references public.waiters(id);

create table if not exists public.venue_promotions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists venue_promotions_active_idx
  on public.venue_promotions(venue_id,is_active,starts_at,ends_at);

create table if not exists public.table_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  token_hash text not null unique,
  guest_name text,
  language text not null default 'ru',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists table_guest_sessions_table_idx
  on public.table_guest_sessions(table_session_id,joined_at);

create table if not exists public.table_shared_cart_items (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  guest_id uuid not null references public.table_guest_sessions(id) on delete cascade,
  product_id uuid not null references public.products(id),
  item_name text not null,
  unit_price numeric not null,
  qty integer not null default 1 check (qty between 1 and 99),
  note text,
  assigned_guest_id uuid references public.table_guest_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists table_shared_cart_items_session_idx
  on public.table_shared_cart_items(table_session_id,updated_at);
create unique index if not exists table_shared_cart_items_guest_product_idx
  on public.table_shared_cart_items(table_session_id,guest_id,product_id);

create table if not exists public.table_service_requests (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  guest_id uuid references public.table_guest_sessions(id) on delete set null,
  request_type text not null check (request_type in ('waiter','bill','more','water','allergy','review')),
  message text,
  status text not null default 'new' check (status in ('new','acknowledged','done','cancelled')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  completed_at timestamptz
);
create index if not exists table_service_requests_open_idx
  on public.table_service_requests(table_session_id,status,created_at desc);

create table if not exists public.table_split_claims (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references public.table_sessions(id) on delete cascade,
  guest_id uuid not null references public.table_guest_sessions(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  split_mode text not null default 'items' check (split_mode in ('items','equal','partial')),
  amount numeric not null default 0 check (amount >= 0),
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists table_split_claims_session_idx
  on public.table_split_claims(table_session_id,status);

create or replace function public.smart_table_context(
  p_venue_id uuid,
  p_qr_token text,
  p_language text default 'ru'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_venue public.venues%rowtype;
  v_table public.venue_tables%rowtype;
  v_session public.table_sessions%rowtype;
  v_waiter_name text;
  v_promotion jsonb;
  v_open_orders integer:=0;
  v_avg_minutes integer:=15;
  v_shift_count integer:=0;
  v_language text:=lower(coalesce(nullif(trim(p_language),''),'ru'));
begin
  select * into v_venue from public.venues where id=p_venue_id and status='active';
  if v_venue.id is null then raise exception 'venue_not_found'; end if;
  select * into v_table from public.venue_tables
    where venue_id=p_venue_id and qr_token=trim(p_qr_token) and is_active=true limit 1;
  if v_table.id is null then raise exception 'table_not_found'; end if;
  if v_table.current_session_id is not null then
    select * into v_session from public.table_sessions where id=v_table.current_session_id and status='active';
  end if;

  select coalesce(v_table.hall_name,nullif(v_table.name,''),'Основной зал') into v_table.hall_name;
  select coalesce(
    (select o.waiter_name from public.orders o where o.table_id=v_table.id and o.status in ('new','changed','cooking','ready','delivery') and nullif(trim(o.waiter_name),'') is not null order by o.updated_at desc limit 1),
    (select w.name from public.waiters w where w.id=v_table.assigned_waiter_id and w.venue_id=p_venue_id and w.is_active=true limit 1)
  ) into v_waiter_name;

  select count(*) into v_open_orders from public.orders o
    where o.table_session_id=v_session.id and o.status in ('new','changed','cooking','ready','delivery');

  select greatest(1,round(coalesce(avg(extract(epoch from (o.ready_at-o.created_at))/60) filter (where o.ready_at is not null and o.created_at > now()-interval '30 days'),15)))::integer
    into v_avg_minutes
    from public.orders o where o.venue_id=p_venue_id and o.order_type='table';

  select count(*) into v_shift_count from public.staff_shifts sh
    where sh.venue_id=p_venue_id and sh.ended_at is null and sh.started_at <= now();

  select jsonb_build_object('id',p.id,'title',p.title,'description',p.description,'starts_at',p.starts_at,'ends_at',p.ends_at)
    into v_promotion
    from public.venue_promotions p
    where p.venue_id=p_venue_id and p.is_active=true and p.starts_at<=now() and (p.ends_at is null or p.ends_at>=now())
    order by p.starts_at desc limit 1;

  return jsonb_build_object(
    'ok',true,
    'language',v_language,
    'restaurant',jsonb_build_object('id',v_venue.id,'name',v_venue.name,'address',v_venue.address,'logo_url',v_venue.logo_url,'brand_color',v_venue.brand_color),
    'branch',jsonb_build_object('name',v_venue.name,'address',v_venue.address),
    'table',jsonb_build_object('id',v_table.id,'number',v_table.table_number,'name',coalesce(v_table.name,'Стол '||v_table.table_number),'hall',v_table.hall_name,'status',v_table.occupancy_status,'session_id',v_session.id,'open_orders',v_open_orders),
    'waiter',case when v_waiter_name is null then null else jsonb_build_object('name',v_waiter_name) end,
    'shift',jsonb_build_object('active',v_shift_count>0,'active_staff',v_shift_count),
    'promotion',coalesce(v_promotion,'null'::jsonb),
    'average_prep_minutes',v_avg_minutes,
    'capabilities',jsonb_build_object('call_waiter',true,'bill',true,'more',true,'split_bill',true,'invite_friend',true,'allergy',true,'water',true,'review',true)
  );
end;
$$;

grant execute on function public.smart_table_context(uuid,text,text) to anon,authenticated;

create or replace function public.smart_table_join(
  p_venue_id uuid,
  p_qr_token text,
  p_guest_token text,
  p_guest_name text default null,
  p_language text default 'ru'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_table public.venue_tables%rowtype;
  v_session public.table_sessions%rowtype;
  v_guest public.table_guest_sessions%rowtype;
  v_hash text;
  v_context jsonb;
begin
  if nullif(trim(p_guest_token),'') is null then raise exception 'guest_token_required'; end if;
  v_hash:=encode(digest(trim(p_guest_token),'sha256'),'hex');
  select * into v_table from public.venue_tables where venue_id=p_venue_id and qr_token=trim(p_qr_token) and is_active=true for update;
  if v_table.id is null then raise exception 'table_not_found'; end if;
  if v_table.occupancy_status='reserved' and v_table.current_session_id is null then raise exception 'table_reserved'; end if;
  if v_table.current_session_id is not null then select * into v_session from public.table_sessions where id=v_table.current_session_id and status='active' for update; end if;
  if v_session.id is null then
    insert into public.table_sessions(venue_id,table_id,status,opened_by_type,opened_by_name,guest_count)
      values(p_venue_id,v_table.id,'active','customer','QR',0) returning * into v_session;
    update public.venue_tables set occupancy_status='occupied',occupied_since=coalesce(occupied_since,now()),current_session_id=v_session.id,guest_count=0 where id=v_table.id;
  end if;

  select * into v_guest from public.table_guest_sessions where table_session_id=v_session.id and token_hash=v_hash and left_at is null limit 1;
  if v_guest.id is null then
    insert into public.table_guest_sessions(table_session_id,token_hash,guest_name,language)
      values(v_session.id,v_hash,nullif(trim(p_guest_name),''),lower(coalesce(nullif(trim(p_language),''),'ru')))
      returning * into v_guest;
  else
    update public.table_guest_sessions set guest_name=coalesce(nullif(trim(p_guest_name),''),guest_name),language=lower(coalesce(nullif(trim(p_language),''),language)),last_seen_at=now() where id=v_guest.id returning * into v_guest;
  end if;
  update public.table_sessions set guest_count=(select count(*) from public.table_guest_sessions g where g.table_session_id=v_session.id and g.left_at is null) where id=v_session.id;
  v_context:=public.smart_table_context(p_venue_id,p_qr_token,p_language);
  return jsonb_build_object('ok',true,'guest_id',v_guest.id,'session_id',v_session.id,'context',v_context);
end;
$$;

grant execute on function public.smart_table_join(uuid,text,text,text,text) to anon,authenticated;

create or replace function public.smart_table_shared_cart(p_guest_token text)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_items jsonb; v_guests jsonb; v_total numeric;
begin
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  update public.table_guest_sessions set last_seen_at=now() where id=v_guest.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'guest_id',i.guest_id,'guest_name',coalesce(g.guest_name,'Гость'),'product_id',i.product_id,'name',i.item_name,'price',i.unit_price,'qty',i.qty,'note',i.note,'assigned_guest_id',i.assigned_guest_id) order by i.created_at),'[]'::jsonb),coalesce(sum(i.unit_price*i.qty),0)
    into v_items,v_total
    from public.table_shared_cart_items i join public.table_guest_sessions g on g.id=i.guest_id
    where i.table_session_id=v_guest.table_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',coalesce(g.guest_name,'Гость'),'language',g.language) order by g.joined_at),'[]'::jsonb') into v_guests
    from public.table_guest_sessions g where g.table_session_id=v_guest.table_session_id and g.left_at is null;
  return jsonb_build_object('ok',true,'session_id',v_guest.table_session_id,'guest_id',v_guest.id,'items',v_items,'guests',v_guests,'total',v_total);
end;
$$;

grant execute on function public.smart_table_shared_cart(text) to anon,authenticated;

create or replace function public.smart_table_add_item(p_guest_token text,p_product_id uuid,p_qty integer default 1,p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_product public.products%rowtype; v_item public.table_shared_cart_items%rowtype;
begin
  if p_qty<1 or p_qty>99 then raise exception 'invalid_item_quantity'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select * into v_product from public.products p join public.table_sessions ts on ts.venue_id=p.venue_id where p.id=p_product_id and ts.id=v_guest.table_session_id and p.is_available=true and p.category<>'addon' limit 1;
  if v_product.id is null then raise exception 'product_not_available'; end if;
  insert into public.table_shared_cart_items(table_session_id,guest_id,product_id,item_name,unit_price,qty,note)
    values(v_guest.table_session_id,v_guest.id,v_product.id,v_product.name,v_product.price,p_qty,nullif(trim(p_note),''))
    on conflict(table_session_id,guest_id,product_id) do update set qty=least(99,table_shared_cart_items.qty+excluded.qty),note=coalesce(excluded.note,table_shared_cart_items.note),updated_at=now()
    returning * into v_item;
  update public.table_guest_sessions set last_seen_at=now() where id=v_guest.id;
  return jsonb_build_object('ok',true,'item_id',v_item.id);
end;
$$;

grant execute on function public.smart_table_add_item(text,uuid,integer,text) to anon,authenticated;

create or replace function public.smart_table_remove_item(p_guest_token text,p_item_id uuid,p_qty integer default 1)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_item public.table_shared_cart_items%rowtype;
begin
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select * into v_item from public.table_shared_cart_items where id=p_item_id and table_session_id=v_guest.table_session_id for update;
  if v_item.id is null then raise exception 'item_not_found'; end if;
  if p_qty>=v_item.qty then delete from public.table_shared_cart_items where id=v_item.id; else update public.table_shared_cart_items set qty=qty-p_qty,updated_at=now() where id=v_item.id; end if;
  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.smart_table_remove_item(text,uuid,integer) to anon,authenticated;

create or replace function public.smart_table_service_request(p_guest_token text,p_request_type text,p_message text default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_id uuid;
begin
  if p_request_type not in ('waiter','bill','more','water','allergy','review') then raise exception 'invalid_service_request'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  insert into public.table_service_requests(table_session_id,guest_id,request_type,message) values(v_guest.table_session_id,v_guest.id,p_request_type,nullif(trim(p_message),'')) returning id into v_id;
  return jsonb_build_object('ok',true,'request_id',v_id);
end;
$$;

grant execute on function public.smart_table_service_request(text,text,text) to anon,authenticated;

create or replace function public.smart_table_split_preview(p_guest_token text,p_mode text default 'items')
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare v_guest public.table_guest_sessions%rowtype; v_items jsonb; v_total numeric; v_count integer;
begin
  if p_mode not in ('items','equal','partial') then raise exception 'invalid_split_mode'; end if;
  select * into v_guest from public.table_guest_sessions where token_hash=encode(digest(trim(p_guest_token),'sha256'),'hex') and left_at is null limit 1;
  if v_guest.id is null then raise exception 'guest_session_not_found'; end if;
  select count(*),coalesce(sum(i.unit_price*i.qty),0) into v_count,v_total from public.table_shared_cart_items i where i.table_session_id=v_guest.table_session_id;
  select coalesce(jsonb_agg(jsonb_build_object('guest_id',g.id,'guest_name',coalesce(g.guest_name,'Гость'),'amount',coalesce(x.amount,0)) order by g.joined_at),'[]'::jsonb') into v_items
  from public.table_guest_sessions g left join (
    select guest_id,sum(unit_price*qty) amount from public.table_shared_cart_items where table_session_id=v_guest.table_session_id group by guest_id
  ) x on x.guest_id=g.id
  where g.table_session_id=v_guest.table_session_id and g.left_at is null;
  if p_mode='equal' and v_count>0 then
    return jsonb_build_object('ok',true,'mode','equal','total',v_total,'guests',jsonb_set(v_items,'{}','null'));
  end if;
  return jsonb_build_object('ok',true,'mode',p_mode,'total',v_total,'guests',v_items);
end;
$$;

grant execute on function public.smart_table_split_preview(text,text) to anon,authenticated;

commit;
