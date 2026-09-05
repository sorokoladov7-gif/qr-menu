begin;

alter table public.plans
  add column if not exists ai_features jsonb not null default '{}'::jsonb;

update public.plans
set ai_features = jsonb_build_object(
  'assistant', coalesce(ai_enabled, false),
  'menu_analysis', false,
  'menu_import', false,
  'analytics', false,
  'recipes', false,
  'chef', false,
  'staff', false,
  'marketing', false,
  'settings', false,
  'engineer', false
)
where ai_features = '{}'::jsonb;

alter table public.plans
  drop constraint if exists plans_ai_features_object;
alter table public.plans
  add constraint plans_ai_features_object check (jsonb_typeof(ai_features) = 'object');

commit;
