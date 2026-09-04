-- Harden delivery quotes and make quote resolution deterministic.

alter table public.delivery_quotes
  drop constraint if exists delivery_quotes_customer_lat_lng_valid;

alter table public.delivery_quotes
  add constraint delivery_quotes_customer_lat_lng_valid
  check (
    customer_lat is not null and customer_lng is not null
    and customer_lat between -90 and 90
    and customer_lng between -180 and 180
  );

create index if not exists idx_delivery_quotes_lookup
  on public.delivery_quotes (venue_id, lower(customer_address), created_at desc)
  where used_at is null;

create index if not exists idx_delivery_integrations_priority
  on public.delivery_integrations (venue_id, enabled, priority, provider);

create or replace function public.resolve_public_delivery_fee(
  p_venue_id uuid,
  p_delivery_address text,
  p_delivery_fee numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  q public.delivery_quotes%rowtype;
begin
  if p_venue_id is null or nullif(trim(p_delivery_address), '') is null then
    raise exception 'delivery_quote_required';
  end if;

  select * into q
  from public.delivery_quotes
  where venue_id = p_venue_id
    and lower(trim(customer_address)) = lower(trim(p_delivery_address))
    and customer_lat is not null
    and customer_lng is not null
    and expires_at > now()
    and used_at is null
  order by created_at desc
  limit 1
  for update skip locked;

  if q.id is null then raise exception 'delivery_quote_required'; end if;
  if abs(coalesce(p_delivery_fee, 0) - q.customer_fee) > 0.01 then raise exception 'delivery_quote_price_mismatch'; end if;

  update public.delivery_quotes set used_at = now() where id = q.id and used_at is null;
  if not found then raise exception 'delivery_quote_already_used'; end if;

  return jsonb_build_object('ok',true,'fee',q.customer_fee,'provider',q.provider,'provider_fee',q.provider_fee,'markup_percent',q.markup_percent,'quote_id',q.id,'eta_minutes',q.eta_minutes,'distance_meters',q.distance_meters);
end;
$function$;

revoke all on function public.resolve_public_delivery_fee(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.resolve_public_delivery_fee(uuid,text,numeric) to anon, authenticated;
revoke all on function public.store_delivery_quote(uuid,text,text,double precision,double precision,numeric,numeric,numeric,integer,integer,jsonb) from public, anon, authenticated;
