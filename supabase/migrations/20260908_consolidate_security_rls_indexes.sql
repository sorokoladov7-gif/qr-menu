begin;

-- QR Menu consolidation: low-risk security/performance cleanup.
-- AI provider credentials remain separate Vercel environment variables;
-- this migration does not merge or rename any AI provider configuration.

alter function public.touch_venue_integrations_updated_at() set search_path = public;

drop index if exists public.idx_staff_sessions_token;
drop index if exists public.idx_staff_sessions_venue;

drop policy if exists ingredient_aliases_manager_select on public.ingredient_aliases;
create policy ingredient_aliases_manager_select
  on public.ingredient_aliases
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = ingredient_aliases.venue_id and mv.manager_id = (select auth.uid()))
  );

drop policy if exists ingredient_aliases_manager_write on public.ingredient_aliases;
create policy ingredient_aliases_manager_write
  on public.ingredient_aliases
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = ingredient_aliases.venue_id and mv.manager_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = ingredient_aliases.venue_id and mv.manager_id = (select auth.uid()))
  );

drop policy if exists recipe_product_aliases_manager_select on public.recipe_product_aliases;
create policy recipe_product_aliases_manager_select
  on public.recipe_product_aliases
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = recipe_product_aliases.venue_id and mv.manager_id = (select auth.uid()))
  );

drop policy if exists recipe_product_aliases_manager_write on public.recipe_product_aliases;
create policy recipe_product_aliases_manager_write
  on public.recipe_product_aliases
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = recipe_product_aliases.venue_id and mv.manager_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.manager_venues mv where mv.venue_id = recipe_product_aliases.venue_id and mv.manager_id = (select auth.uid()))
  );

commit;
