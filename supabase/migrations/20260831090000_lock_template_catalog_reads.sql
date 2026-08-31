-- Lock down normalized template catalog rows.
-- Published templates remain manageable by admins and are consumed server-side
-- by the existing create_venue_from_template/create_venue_for_manager RPCs.
-- Direct browser reads of categories/products are intentionally disabled.

alter table public.menu_template_categories enable row level security;
alter table public.menu_template_products enable row level security;

drop policy if exists "menu template categories read active" on public.menu_template_categories;
drop policy if exists "menu template products read active" on public.menu_template_products;

drop policy if exists "menu template categories admin all" on public.menu_template_categories;
drop policy if exists "menu template products admin all" on public.menu_template_products;

create policy "menu template categories admin all"
on public.menu_template_categories
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "menu template products admin all"
on public.menu_template_products
for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Keep the normalized catalog inaccessible to the public API even if a future
-- policy is accidentally added without first granting the table privileges.
revoke select on public.menu_template_categories from anon, authenticated;
revoke select on public.menu_template_products from anon, authenticated;

grant select, insert, update, delete on public.menu_template_categories to authenticated;
grant select, insert, update, delete on public.menu_template_products to authenticated;

comment on table public.menu_template_categories is
  'Template catalog categories. Client reads are intentionally blocked; use trusted RPCs.';
comment on table public.menu_template_products is
  'Template catalog products. Client reads are intentionally blocked; use trusted RPCs.';
