-- Add indexes for foreign-key columns that are used by joins and deletes.
-- These indexes reduce lookup cost for venue tables/calls and alias cleanup.

begin;

create index if not exists cook_calls_table_id_idx on public.cook_calls(table_id);
create index if not exists waiter_calls_table_id_idx on public.waiter_calls(table_id);
create index if not exists ingredient_aliases_ingredient_id_idx on public.ingredient_aliases(ingredient_id);
create index if not exists recipe_product_aliases_product_id_idx on public.recipe_product_aliases(product_id);

commit;
