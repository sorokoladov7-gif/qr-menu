begin;

create table if not exists public.delivery_integrations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  provider text not null check (provider in ('yandex','delivery','samokat','custom')),
  enabled boolean not null default true,
  priority integer not null default 100 check (priority between 1 and 999),
  pricing_mode text not null default 'provider_plus_percent' check (pricing_mode in ('provider','provider_plus_percent','fixed')),
  markup_percent numeric(7,2) not null default 0 check (markup_percent between 0 and 1000),
  fixed_fee numeric(12,2) not null default 0 check (fixed_fee >= 0),
  api_token text,
  config jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, provider)
);

create index if not exists delivery_integrations_venue_priority_idx on public.delivery_integrations(venue_id, enabled, priority);

create table if not exists public.delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  provider text not null,
  customer_address text not null,
  customer_lat double precision,
  customer_lng double precision,
  provider_fee numeric(12,2) not null check (provider_fee >= 0),
  customer_fee numeric(12,2) not null check (customer_fee >= 0),
  markup_percent numeric(7,2) not null default 0,
  eta_minutes integer,
  distance_meters integer,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_quotes_lookup_idx on public.delivery_quotes(venue_id, customer_address, expires_at desc);

alter table public.delivery_integrations enable row level security;
alter table public.delivery_quotes enable row level security;
revoke all on table public.delivery_integrations from anon, authenticated;
revoke all on table public.delivery_quotes from anon, authenticated;
grant all on table public.delivery_integrations to service_role;
grant all on table public.delivery_quotes to service_role;

create or replace function public.manager_delivery_integrations_list(p_venue_id uuid)
returns table(id uuid, provider text, enabled boolean, priority integer, pricing_mode text, markup_percent numeric, fixed_fee numeric, connected boolean, last_tested_at timestamptz, last_error text)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager_of(p_venue_id) and not public.is_admin() then raise exception 'not_authorized'; end if;
  return query
  select di.id,di.provider,di.enabled,di.priority,di.pricing_mode,di.markup_percent,di.fixed_fee,(nullif(di.api_token,'') is not null),di.last_tested_at,di.last_error
  from public.delivery_integrations di where di.venue_id=p_venue_id order by di.priority,di.provider;
end;
$$;

create or replace function public.manager_delivery_integration_upsert(
  p_venue_id uuid,p_provider text,p_enabled boolean default true,p_priority integer default 100,
  p_pricing_mode text default 'provider_plus_percent',p_markup_percent numeric default 0,
  p_fixed_fee numeric default 0,p_api_token text default null,p_config jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_connected boolean;
begin
  if not public.is_manager_of(p_venue_id) and not public.is_admin() then raise exception 'not_authorized'; end if;
  if not public.is_admin() and not public.manager_has_permission(p_venue_id,'edit_delivery') then raise exception 'delivery_permission_required'; end if;
  if p_provider not in ('yandex','delivery','samokat','custom') then raise exception 'invalid_delivery_provider'; end if;
  if p_priority < 1 or p_priority > 999 then raise exception 'invalid_delivery_priority'; end if;
  if p_pricing_mode not in ('provider','provider_plus_percent','fixed') then raise exception 'invalid_delivery_pricing_mode'; end if;
  if p_markup_percent < 0 or p_markup_percent > 1000 then raise exception 'invalid_delivery_markup'; end if;
  insert into public.delivery_integrations(venue_id,provider,enabled,priority,pricing_mode,markup_percent,fixed_fee,api_token,config,updated_at)
  values(p_venue_id,p_provider,coalesce(p_enabled,true),p_priority,p_pricing_mode,greatest(0,p_markup_percent),greatest(0,p_fixed_fee),nullif(trim(coalesce(p_api_token,'')),''),coalesce(p_config,'{}'::jsonb),now())
  on conflict (venue_id,provider) do update set enabled=excluded.enabled,priority=excluded.priority,pricing_mode=excluded.pricing_mode,markup_percent=excluded.markup_percent,fixed_fee=excluded.fixed_fee,
    api_token=case when excluded.api_token is null then public.delivery_integrations.api_token else excluded.api_token end,
    config=excluded.config,updated_at=now(),last_error=null;
  select di.id,(nullif(di.api_token,'') is not null) into v_id,v_connected from public.delivery_integrations di where di.venue_id=p_venue_id and di.provider=p_provider;
  return jsonb_build_object('ok',true,'id',v_id,'provider',p_provider,'connected',v_connected);
end;
$$;

create or replace function public.manager_delivery_integration_delete(p_venue_id uuid,p_provider text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_manager_of(p_venue_id) and not public.is_admin() then raise exception 'not_authorized'; end if;
  if not public.is_admin() and not public.manager_has_permission(p_venue_id,'edit_delivery') then raise exception 'delivery_permission_required'; end if;
  delete from public.delivery_integrations where venue_id=p_venue_id and provider=p_provider;
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.manager_delivery_integrations_list(uuid) from public,anon;
revoke all on function public.manager_delivery_integration_upsert(uuid,text,boolean,integer,text,numeric,numeric,text,jsonb) from public,anon;
revoke all on function public.manager_delivery_integration_delete(uuid,text) from public,anon;
grant execute on function public.manager_delivery_integrations_list(uuid) to authenticated;
grant execute on function public.manager_delivery_integration_upsert(uuid,text,boolean,integer,text,numeric,numeric,text,jsonb) to authenticated;
grant execute on function public.manager_delivery_integration_delete(uuid,text) to authenticated;

create or replace function public.store_delivery_quote(p_venue_id uuid,p_provider text,p_customer_address text,p_customer_lat double precision,p_customer_lng double precision,p_provider_fee numeric,p_customer_fee numeric,p_markup_percent numeric default 0,p_eta_minutes integer default null,p_distance_meters integer default null,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_provider not in ('yandex','delivery','samokat','custom') then raise exception 'invalid_delivery_provider'; end if;
  if not exists(select 1 from public.venues v where v.id=p_venue_id and v.status='active') then raise exception 'venue_not_found'; end if;
  if p_provider_fee < 0 or p_customer_fee < 0 then raise exception 'invalid_delivery_fee'; end if;
  insert into public.delivery_quotes(venue_id,provider,customer_address,customer_lat,customer_lng,provider_fee,customer_fee,markup_percent,eta_minutes,distance_meters,metadata)
  values(p_venue_id,p_provider,p_customer_address,p_customer_lat,p_customer_lng,round(p_provider_fee,2),round(p_customer_fee,2),greatest(0,p_markup_percent),p_eta_minutes,p_distance_meters,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.store_delivery_quote(uuid,text,text,double precision,double precision,numeric,numeric,numeric,integer,integer,jsonb) from public,anon,authenticated;
grant execute on function public.store_delivery_quote(uuid,text,text,double precision,double precision,numeric,numeric,numeric,integer,integer,jsonb) to service_role;

create or replace function public.resolve_public_delivery_fee(p_venue_id uuid,p_delivery_address text,p_delivery_fee numeric)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare q public.delivery_quotes%rowtype;
begin
  select * into q from public.delivery_quotes
  where venue_id=p_venue_id and lower(trim(customer_address))=lower(trim(p_delivery_address))
    and expires_at>now() and used_at is null
  order by created_at desc limit 1;
  if q.id is null then raise exception 'delivery_quote_required'; end if;
  if abs(coalesce(p_delivery_fee,0)-q.customer_fee)>0.01 then raise exception 'delivery_quote_price_mismatch'; end if;
  update public.delivery_quotes set used_at=now() where id=q.id;
  return jsonb_build_object('ok',true,'fee',q.customer_fee,'provider',q.provider,'provider_fee',q.provider_fee,'markup_percent',q.markup_percent,'quote_id',q.id,'eta_minutes',q.eta_minutes,'distance_meters',q.distance_meters);
end;
$$;
revoke all on function public.resolve_public_delivery_fee(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.resolve_public_delivery_fee(uuid,text,numeric) to anon,authenticated;

-- The public wrapper now requires a fresh server-side delivery quote for delivery orders.
create or replace function public.create_public_order(
  p_venue_id uuid,p_order_type text,p_customer_name text,p_customer_phone text,p_delivery_address text,p_comment text,
  p_payment_method text,p_items jsonb,p_addons jsonb,p_total_price numeric,p_table_token text default null,p_delivery_fee numeric default 0)
returns jsonb language plpgsql security definer set search_path = 'public' as $$
declare v_quote jsonb; v_fee numeric;
begin
  if p_order_type='delivery' then
    v_quote:=public.resolve_public_delivery_fee(p_venue_id,p_delivery_address,p_delivery_fee);
    v_fee:=coalesce((v_quote->>'fee')::numeric,0);
  else
    v_fee:=0;
  end if;
  return public.create_public_order_canonical(
    p_venue_id,p_order_type,p_customer_name,p_customer_phone,p_delivery_address,p_comment,p_payment_method,p_items,p_addons,
    p_table_token,null,null,null,p_total_price,v_fee
  );
end;
$$;
revoke execute on function public.create_public_order_canonical(uuid,text,text,text,text,text,text,jsonb,jsonb,text,double precision,double precision,text,numeric,numeric) from anon,authenticated,public;
grant execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric) to anon,authenticated;

commit;
