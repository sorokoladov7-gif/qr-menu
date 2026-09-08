begin;

-- Merge admin + manager policies where both policies have identical ALL/SELECT
-- semantics and differ only by authorization predicate. This preserves access
-- while removing duplicate permissive policy evaluation.

drop policy if exists ingredients_admin_all on public.ingredients;
drop policy if exists ingredients_manager_all on public.ingredients;
create policy ingredients_staff_all on public.ingredients
  for all to public
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or exists (
      select 1 from public.manager_venues mv
      where mv.manager_id = (select auth.uid())
        and mv.venue_id = ingredients.venue_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or exists (
      select 1 from public.manager_venues mv
      where mv.manager_id = (select auth.uid())
        and mv.venue_id = ingredients.venue_id
    )
  );

drop policy if exists product_ingredients_admin_all on public.product_ingredients;
drop policy if exists product_ingredients_manager_all on public.product_ingredients;
create policy product_ingredients_staff_all on public.product_ingredients
  for all to public
  using (
    exists (
      select 1
      from public.products pr
      where pr.id = product_ingredients.product_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'admin'
          )
          or exists (
            select 1 from public.manager_venues mv
            where mv.venue_id = pr.venue_id
              and mv.manager_id = (select auth.uid())
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.products pr
      join public.ingredients i on i.id = product_ingredients.ingredient_id
      where pr.id = product_ingredients.product_id
        and pr.venue_id = i.venue_id
        and (
          exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'admin'
          )
          or exists (
            select 1 from public.manager_venues mv
            where mv.venue_id = pr.venue_id
              and mv.manager_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists "manager read own links" on public.manager_venues;
drop policy if exists "admin read all links" on public.manager_venues;
create policy manager_venues_read on public.manager_venues
  for select to public
  using (
    manager_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
  );

commit;
