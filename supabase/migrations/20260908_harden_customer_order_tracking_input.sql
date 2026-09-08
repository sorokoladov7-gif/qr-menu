begin;

-- Customer order tracking is intentionally public, but the lookup input is a bearer-style
-- identifier. Reject empty/short/non-phone-like input before touching order data.
create or replace function public.customer_track_order_json(p_venue_id uuid, p_customer_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  last_order jsonb;
  normalized_phone text;
begin
  normalized_phone := regexp_replace(coalesce(p_customer_phone,''), '\\D', '', 'g');

  if p_venue_id is null or length(normalized_phone) < 7 or length(normalized_phone) > 15 then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'total_price', o.total_price,
    'delivery_fee', o.delivery_fee,
    'order_type', o.order_type,
    'table_id', o.table_id,
    'table_session_id', o.table_session_id,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'cooking_started_at', o.cooking_started_at,
    'ready_at', o.ready_at,
    'cook_name', o.cook_name,
    'waiter_name', o.waiter_name,
    'courier_name', o.courier_name,
    'items', coalesce((select jsonb_agg(jsonb_build_object('name',oi.name,'qty',oi.qty,'price',oi.price) order by oi.id) from order_items oi where oi.order_id=o.id),'[]'::jsonb),
    'addons', coalesce((select jsonb_agg(jsonb_build_object('name',oa.name,'price',oa.price,'item_name',oa.item_name) order by oa.id) from order_addons oa where oa.order_id=o.id),'[]'::jsonb)
  ) into last_order
  from orders o
  where o.venue_id=p_venue_id
    and regexp_replace(coalesce(o.customer_phone,''), '\\D', '', 'g') = normalized_phone
  order by o.created_at desc
  limit 1;

  return last_order;
end;
$function$;

-- get_public_order is a legacy wrapper with no repository callers; keep it available
-- for compatibility, but retain the same hardened implementation underneath.
commit;
