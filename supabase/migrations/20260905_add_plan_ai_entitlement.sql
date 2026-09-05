begin;

alter table public.plans
  add column if not exists base_price numeric not null default 0,
  add column if not exists ai_enabled boolean not null default false,
  add column if not exists ai_addon_price numeric not null default 0;

update public.plans
set base_price = coalesce(price, 0)
where base_price = 0 and coalesce(price, 0) <> 0;

alter table public.plans
  drop constraint if exists plans_ai_addon_price_nonnegative;
alter table public.plans
  add constraint plans_ai_addon_price_nonnegative check (ai_addon_price >= 0);

alter table public.plans
  drop constraint if exists plans_base_price_nonnegative;
alter table public.plans
  add constraint plans_base_price_nonnegative check (base_price >= 0);

alter table public.plans
  drop constraint if exists plans_price_nonnegative;
alter table public.plans
  add constraint plans_price_nonnegative check (price >= 0);

commit;
