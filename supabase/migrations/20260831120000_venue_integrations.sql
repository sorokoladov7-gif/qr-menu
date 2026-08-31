-- OS QR-Menu: integrations registry.
-- Credentials are encrypted by the Vercel API using INTEGRATION_ENCRYPTION_KEY.
create table if not exists public.venue_integrations (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  provider text not null check (provider in ('iiko','quick_resto','r_keeper','poster','onec')),
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  credentials_encrypted text,
  metadata jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, provider)
);

create index if not exists idx_venue_integrations_venue on public.venue_integrations(venue_id);

alter table public.venue_integrations enable row level security;

-- Managers can see integrations only for venues they are assigned to.
drop policy if exists venue_integrations_manager_select on public.venue_integrations;
create policy venue_integrations_manager_select
on public.venue_integrations for select to authenticated
using (
  exists (
    select 1 from public.manager_venue_permissions p
    where p.venue_id = venue_integrations.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  )
);

drop policy if exists venue_integrations_manager_insert on public.venue_integrations;
create policy venue_integrations_manager_insert
on public.venue_integrations for insert to authenticated
with check (
  exists (
    select 1 from public.manager_venue_permissions p
    where p.venue_id = venue_integrations.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  )
);

drop policy if exists venue_integrations_manager_update on public.venue_integrations;
create policy venue_integrations_manager_update
on public.venue_integrations for update to authenticated
using (
  exists (
    select 1 from public.manager_venue_permissions p
    where p.venue_id = venue_integrations.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.manager_venue_permissions p
    where p.venue_id = venue_integrations.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  )
);

drop policy if exists venue_integrations_manager_delete on public.venue_integrations;
create policy venue_integrations_manager_delete
on public.venue_integrations for delete to authenticated
using (
  exists (
    select 1 from public.manager_venue_permissions p
    where p.venue_id = venue_integrations.venue_id
      and p.manager_id = auth.uid()
  )
  or exists (
    select 1 from public.profiles pr
    where pr.id = auth.uid() and pr.role = 'admin'
  )
);

create or replace function public.touch_venue_integrations_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_venue_integrations_updated_at on public.venue_integrations;
create trigger trg_venue_integrations_updated_at
before update on public.venue_integrations
for each row execute function public.touch_venue_integrations_updated_at();
