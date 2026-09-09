-- QR Menu: persist the recipe AI/photo-card schema used by QRChick.
alter table if exists public.manager_tech_cards add column if not exists source_type text not null default 'photo';
alter table if exists public.manager_tech_cards add column if not exists global_recipe_id uuid;
alter table if exists public.manager_tech_cards add column if not exists title text;
alter table if exists public.manager_tech_cards add column if not exists recipe_data jsonb not null default '{}'::jsonb;
create unique index if not exists ux_manager_tech_cards_database_recipe
  on public.manager_tech_cards (venue_id, product_id, global_recipe_id)
  where source_type='database' and global_recipe_id is not null;
create index if not exists idx_manager_tech_cards_venue_product_created
  on public.manager_tech_cards (venue_id, product_id, created_at desc);

-- Keep imported database tech cards and photo-analyzed cards usable by the existing RLS policies.
update public.manager_tech_cards
set source_type='photo'
where source_type is null;
