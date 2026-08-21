create table if not exists public.menu_template_categories (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.menu_templates(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(template_id, slug)
);
create index if not exists idx_menu_template_categories_template on public.menu_template_categories(template_id, sort_order);

create table if not exists public.menu_template_products (
  id uuid primary key default gen_random_uuid(),
  template_id text not null references public.menu_templates(id) on delete cascade,
  category_id uuid references public.menu_template_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric not null default 0 check(price >= 0),
  category text not null default 'main',
  image_url text,
  applies_to text not null default 'all',
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_menu_template_products_template on public.menu_template_products(template_id, sort_order);
create index if not exists idx_menu_template_products_category on public.menu_template_products(category_id, sort_order);

alter table public.menu_template_categories enable row level security;
alter table public.menu_template_products enable row level security;

create policy "menu template categories admin all" on public.menu_template_categories for all to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "menu template categories read active" on public.menu_template_categories for select to authenticated using(exists(select 1 from public.menu_templates t where t.id=template_id and t.is_active=true));
create policy "menu template products admin all" on public.menu_template_products for all to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "menu template products read active" on public.menu_template_products for select to authenticated using(exists(select 1 from public.menu_templates t where t.id=template_id and t.is_active=true));

alter table public.menu_templates add column if not exists niche text not null default 'other';
alter table public.menu_templates add column if not exists scale_code text not null default 'M';
alter table public.menu_templates add column if not exists target_product_count integer not null default 0;
alter table public.menu_templates add column if not exists cover_image_url text;
