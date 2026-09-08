create or replace function public.manager_ai_validate_price_change(p_product_id uuid, p_new_price numeric)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old numeric;
begin
  if p_product_id is null or p_new_price is null or p_new_price < 0 then
    raise exception 'PRODUCT_PRICE_INVALID' using errcode = '22023';
  end if;

  select price into v_old
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_old is not null and v_old > 0 and (p_new_price < v_old * 0.9 or p_new_price > v_old * 1.1) then
    raise exception 'PRODUCT_PRICE_CHANGE_LIMIT_EXCEEDED' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.manager_ai_validate_price_change(uuid,numeric) from public;
grant execute on function public.manager_ai_validate_price_change(uuid,numeric) to authenticated;
