create table if not exists public.manager_ai_usage (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid null references public.venues(id) on delete set null,
  feature text not null,
  model text not null,
  plan_id text null,
  subscription_status text null,
  prompt_tokens integer not null default 0,
  output_tokens integer not null default 0,
  thoughts_tokens integer not null default 0,
  total_tokens integer not null default 0,
  cached_tokens integer not null default 0,
  tool_tokens integer not null default 0,
  request_ms integer null,
  fallback_used boolean not null default false,
  fallback_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists manager_ai_usage_manager_created_idx on public.manager_ai_usage(manager_id, created_at desc);
create index if not exists manager_ai_usage_venue_created_idx on public.manager_ai_usage(venue_id, created_at desc);
create index if not exists manager_ai_usage_model_created_idx on public.manager_ai_usage(model, created_at desc);
create index if not exists manager_ai_usage_feature_created_idx on public.manager_ai_usage(feature, created_at desc);

alter table public.manager_ai_usage enable row level security;
revoke all on table public.manager_ai_usage from anon, authenticated;
grant select, insert on table public.manager_ai_usage to authenticated;

drop policy if exists manager_ai_usage_select_own on public.manager_ai_usage;
create policy manager_ai_usage_select_own on public.manager_ai_usage
for select to authenticated
using ((select auth.uid()) = manager_id);

drop policy if exists manager_ai_usage_insert_own on public.manager_ai_usage;
create policy manager_ai_usage_insert_own on public.manager_ai_usage
for insert to authenticated
with check ((select auth.uid()) = manager_id);
