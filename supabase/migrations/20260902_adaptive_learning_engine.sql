-- QR Menu — Adaptive Learning Engine
-- Stores reusable analyzer knowledge without coupling it to one website.

create table if not exists public.site_analyzer_learning_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_type text not null check (pattern_type in (
    'card_structure',
    'name_selector',
    'price_selector',
    'description_selector',
    'image_selector',
    'category_selector',
    'menu_link',
    'api_endpoint',
    'jsonld_structure',
    'platform_signature',
    'rejection_signal'
  )),
  pattern_key text not null,
  pattern_value jsonb not null default '{}'::jsonb,
  scope text not null default 'global' check (scope in ('global','platform','domain')),
  domain text,
  observations integer not null default 0,
  successes integer not null default 0,
  failures integer not null default 0,
  confidence numeric(5,4) not null default 0.5000 check (confidence >= 0 and confidence <= 1),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pattern_type, pattern_key, scope, domain)
);

create index if not exists idx_site_analyzer_learning_patterns_lookup
  on public.site_analyzer_learning_patterns(pattern_type, confidence desc, observations desc);

create index if not exists idx_site_analyzer_learning_patterns_domain
  on public.site_analyzer_learning_patterns(domain, pattern_type, confidence desc);

create table if not exists public.site_analyzer_learning_runs (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  source_url text,
  products_found integer not null default 0,
  high_confidence_products integer not null default 0,
  medium_confidence_products integer not null default 0,
  low_confidence_products integer not null default 0,
  patterns_discovered integer not null default 0,
  patterns_reused integer not null default 0,
  diagnostics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_analyzer_learning_runs_domain
  on public.site_analyzer_learning_runs(domain, created_at desc);

create or replace function public.update_site_analyzer_learning_pattern(
  p_pattern_type text,
  p_pattern_key text,
  p_pattern_value jsonb default '{}'::jsonb,
  p_scope text default 'global',
  p_domain text default null,
  p_success boolean default true
)
returns public.site_analyzer_learning_patterns
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.site_analyzer_learning_patterns;
  next_observations integer;
  next_successes integer;
  next_failures integer;
  next_confidence numeric(5,4);
begin
  insert into public.site_analyzer_learning_patterns (
    pattern_type, pattern_key, pattern_value, scope, domain,
    observations, successes, failures, confidence, last_seen_at, updated_at
  ) values (
    p_pattern_type, p_pattern_key, coalesce(p_pattern_value, '{}'::jsonb), p_scope, p_domain,
    1,
    case when p_success then 1 else 0 end,
    case when p_success then 0 else 1 end,
    case when p_success then 1.0 else 0.0 end,
    now(), now()
  )
  on conflict (pattern_type, pattern_key, scope, domain)
  do update set
    pattern_value = case
      when public.site_analyzer_learning_patterns.observations < 100
      then excluded.pattern_value
      else public.site_analyzer_learning_patterns.pattern_value
    end,
    observations = public.site_analyzer_learning_patterns.observations + 1,
    successes = public.site_analyzer_learning_patterns.successes + case when p_success then 1 else 0 end,
    failures = public.site_analyzer_learning_patterns.failures + case when p_success then 0 else 1 end,
    confidence = greatest(0.01, least(0.99,
      (public.site_analyzer_learning_patterns.successes + case when p_success then 1 else 0 end)::numeric /
      greatest(1, public.site_analyzer_learning_patterns.observations + 1)::numeric
    )),
    last_seen_at = now(),
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke all on function public.update_site_analyzer_learning_pattern(text,text,jsonb,text,text,boolean) from public;
grant execute on function public.update_site_analyzer_learning_pattern(text,text,jsonb,text,text,boolean) to service_role;

drop trigger if exists trg_site_analyzer_learning_patterns_updated_at on public.site_analyzer_learning_patterns;
create or replace function public.set_site_analyzer_learning_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_site_analyzer_learning_patterns_updated_at
before update on public.site_analyzer_learning_patterns
for each row execute function public.set_site_analyzer_learning_updated_at();

alter table public.site_analyzer_learning_patterns enable row level security;
alter table public.site_analyzer_learning_runs enable row level security;

-- Learning data is written by the server-side importer through service_role.
-- No client-side access is granted by this migration.
