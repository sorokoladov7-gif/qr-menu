-- QR Menu: recipe workspace performance + persisted tech cards
create index if not exists idx_products_venue_name
  on public.products (venue_id, name);

create index if not exists idx_manager_tech_cards_venue_created
  on public.manager_tech_cards (venue_id, created_at desc);

create or replace function public.manager_tech_card_create(
  p_venue_id uuid,
  p_product_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_url text,
  p_ocr_text text,
  p_status text default 'processed'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_manager uuid := auth.uid();
  v_id uuid;
begin
  if not exists (
    select 1
    from public.manager_venues mv
    where mv.venue_id = p_venue_id
      and mv.manager_id = v_manager
  )
  and not exists (
    select 1
    from public.profiles p
    where p.id = v_manager
      and p.role = 'admin'
  ) then
    raise exception 'forbidden';
  end if;

  if p_product_id is not null and not exists (
    select 1
    from public.products pr
    where pr.id = p_product_id
      and pr.venue_id = p_venue_id
  ) then
    raise exception 'product_not_found';
  end if;

  insert into public.manager_tech_cards
    (venue_id, product_id, file_name, file_path, file_url, ocr_text, status, created_by)
  values
    (p_venue_id,
     p_product_id,
     nullif(trim(p_file_name), ''),
     nullif(trim(p_file_path), ''),
     nullif(trim(p_file_url), ''),
     coalesce(p_ocr_text, ''),
     coalesce(nullif(trim(p_status), ''), 'processed'),
     v_manager)
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$function$;
