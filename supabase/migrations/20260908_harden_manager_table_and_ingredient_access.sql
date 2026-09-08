-- Harden manager RPC access checks without changing the public API.
-- manager_next_table_number previously accepted any manager_venue_permissions row,
-- regardless of permission flags; manager_ingredient_list also had a single-venue
-- fallback that could return data for the manager's own venue when another venue_id
-- was supplied. Both now use the canonical venue ownership/admin check.

create or replace function public.manager_next_table_number(p_venue_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  n integer := 1;
begin
  if not public.manager_can_manage_venue(p_venue_id) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.venues v where v.id = p_venue_id) then
    raise exception 'venue_not_found';
  end if;

  loop
    if not exists (
      select 1 from public.venue_tables t
      where t.venue_id = p_venue_id
        and t.table_number = n
        and t.is_active = true
    ) then
      return n;
    end if;
    n := n + 1;
  end loop;
end;
$$;

create or replace function public.manager_ingredient_list(p_venue_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not public.manager_can_manage_venue(p_venue_id) then
    raise exception 'forbidden';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'name', i.name,
        'unit', i.unit,
        'purchase_quantity', i.purchase_quantity,
        'purchase_price', i.purchase_price,
        'is_active', i.is_active
      ) order by i.name
    ),
    '[]'::jsonb
  )
  into v_result
  from public.ingredients i
  where i.venue_id = p_venue_id
    and i.is_active = true;

  return v_result;
end;
$$;
