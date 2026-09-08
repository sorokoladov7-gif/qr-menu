create or replace function public.create_public_order(
  p_venue_id uuid,
  p_order_type text,
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_comment text,
  p_payment_method text,
  p_items jsonb,
  p_addons jsonb,
  p_total_price numeric,
  p_table_token text default null,
  p_delivery_fee numeric default 0,
  p_operation_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_quote jsonb;
  v_fee numeric;
  v_result jsonb;
  v_order_id uuid;
  v_existing jsonb;
  v_operation_key text;
begin
  v_operation_key := nullif(trim(p_operation_key), '');
  if v_operation_key is not null then
    if length(v_operation_key) > 200 then raise exception 'operation_key_too_long'; end if;
    perform pg_advisory_xact_lock(hashtext(p_venue_id::text || ':' || v_operation_key));
    select oi.result into v_existing
      from public.operation_idempotency oi
     where oi.venue_id = p_venue_id and oi.operation_key = v_operation_key
     limit 1;
    if v_existing is not null then return v_existing; end if;
  end if;
  if p_order_type = 'delivery' then
    v_quote := public.resolve_public_delivery_fee(p_venue_id, p_delivery_address, p_delivery_fee);
    v_fee := coalesce((v_quote->>'fee')::numeric, 0);
  else v_fee := 0; end if;
  v_result := public.create_public_order_canonical(
    p_venue_id,p_order_type,p_customer_name,p_customer_phone,p_delivery_address,
    p_comment,p_payment_method,p_items,p_addons,p_table_token,null,null,
    v_operation_key,p_total_price,v_fee
  );
  v_order_id := (v_result->>'id')::uuid;
  if p_order_type = 'delivery' and v_order_id is not null then
    update public.orders set
      delivery_provider = v_quote->>'provider',
      delivery_provider_fee = coalesce((v_quote->>'provider_fee')::numeric, 0),
      delivery_markup_percent = coalesce((v_quote->>'markup_percent')::numeric, 0),
      delivery_markup_amount = greatest(0,coalesce((v_quote->>'fee')::numeric,0)-coalesce((v_quote->>'provider_fee')::numeric,0))
    where id = v_order_id;
    v_result := v_result || jsonb_build_object(
      'delivery_provider',v_quote->>'provider',
      'delivery_provider_fee',coalesce((v_quote->>'provider_fee')::numeric,0),
      'delivery_markup_percent',coalesce((v_quote->>'markup_percent')::numeric,0),
      'delivery_markup_amount',greatest(0,coalesce((v_quote->>'fee')::numeric,0)-coalesce((v_quote->>'provider_fee')::numeric,0))
    );
    if v_operation_key is not null then
      update public.operation_idempotency set result = v_result
       where venue_id = p_venue_id and operation_key = v_operation_key;
    end if;
  end if;
  return v_result;
end;
$function$;
