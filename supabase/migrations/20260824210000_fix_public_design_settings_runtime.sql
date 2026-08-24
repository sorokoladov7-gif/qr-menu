begin;

-- Keep the repository migration history aligned with the live public RPCs.
-- The client-side design runtime needs design_settings when a customer opens menu.html.

drop function if exists public.public_venue_by_slug(text);
create function public.public_venue_by_slug(p_slug text)
returns table(
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  brand_color text,
  status text,
  address text,
  lat numeric,
  lng numeric,
  latitude double precision,
  longitude double precision,
  delivery_base_price numeric,
  delivery_per_km numeric,
  delivery_max_km numeric,
  delivery_rate_per_km numeric,
  delivery_min_order numeric,
  delivery_min_order_free numeric,
  delivery_base_fee numeric,
  delivery_enabled boolean,
  design_settings jsonb
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    v.id,
    v.name,
    v.slug,
    v.description,
    v.logo_url,
    v.brand_color,
    v.status,
    v.address,
    v.lat,
    v.lng,
    v.latitude,
    v.longitude,
    v.delivery_base_price,
    v.delivery_per_km,
    v.delivery_max_km,
    v.delivery_rate_per_km,
    v.delivery_min_order,
    v.delivery_min_order_free,
    v.delivery_base_fee,
    v.delivery_enabled,
    v.design_settings
  from public.venues v
  where v.slug = lower(trim(p_slug))
  limit 1;
$function$;

grant execute on function public.public_venue_by_slug(text) to anon, authenticated, service_role;

-- Public venue selection must expose the same design payload as direct slug lookup.
drop function if exists public.public_venues_list();
create function public.public_venues_list()
returns table(
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  brand_color text,
  status text,
  delivery_enabled boolean,
  address text,
  lat numeric,
  lng numeric,
  latitude double precision,
  longitude double precision,
  delivery_base_price numeric,
  delivery_per_km numeric,
  delivery_max_km numeric,
  delivery_rate_per_km numeric,
  delivery_min_order numeric,
  delivery_min_order_free numeric,
  delivery_base_fee numeric,
  design_settings jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    v.id,
    v.name,
    v.slug,
    v.description,
    v.logo_url,
    v.brand_color,
    v.status,
    v.delivery_enabled,
    v.address,
    v.lat,
    v.lng,
    v.latitude,
    v.longitude,
    v.delivery_base_price,
    v.delivery_per_km,
    v.delivery_max_km,
    v.delivery_rate_per_km,
    v.delivery_min_order,
    v.delivery_min_order_free,
    v.delivery_base_fee,
    v.design_settings
  from public.venues v
  where v.status = 'active'
  order by v.name;
end;
$function$;

grant execute on function public.public_venues_list() to anon, authenticated, service_role;

commit;
