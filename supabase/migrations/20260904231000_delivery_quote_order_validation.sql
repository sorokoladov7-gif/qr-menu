begin;

-- Validate the client-visible delivery price against a fresh server-side quote.
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
