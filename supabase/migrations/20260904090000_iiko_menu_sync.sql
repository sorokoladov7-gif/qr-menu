-- iiko -> QR Menu durable mapping. Keeps repeat imports idempotent and preserves manually created products.
create table if not exists public.integration_item_mappings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  provider text not null,
  external_id text not null,
  entity_type text not null default 'product',
  local_id uuid null,
  external_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(venue_id,provider,entity_type,external_id)
);
create index if not exists idx_integration_item_mappings_local on public.integration_item_mappings(venue_id,provider,local_id);
create table if not exists public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  provider text not null,
  status text not null default 'running' check(status in ('running','success','partial','error')),
  mode text not null default 'preview' check(mode in ('preview','import')),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  unchanged_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_integration_sync_runs_venue on public.integration_sync_runs(venue_id,provider,created_at desc);
alter table public.integration_item_mappings enable row level security;
alter table public.integration_sync_runs enable row level security;
drop policy if exists integration_item_mappings_admin on public.integration_item_mappings;
create policy integration_item_mappings_admin on public.integration_item_mappings for all using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists integration_item_mappings_manager on public.integration_item_mappings;
create policy integration_item_mappings_manager on public.integration_item_mappings for select using(exists(select 1 from public.manager_venues mv where mv.manager_id=auth.uid() and mv.venue_id=integration_item_mappings.venue_id));
drop policy if exists integration_sync_runs_admin on public.integration_sync_runs;
create policy integration_sync_runs_admin on public.integration_sync_runs for all using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists integration_sync_runs_manager on public.integration_sync_runs;
create policy integration_sync_runs_manager on public.integration_sync_runs for select using(exists(select 1 from public.manager_venues mv where mv.manager_id=auth.uid() and mv.venue_id=integration_sync_runs.venue_id));
