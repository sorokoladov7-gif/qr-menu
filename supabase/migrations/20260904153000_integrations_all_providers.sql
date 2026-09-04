-- Allow the complete canonical integration catalog.
alter table public.venue_integrations drop constraint if exists venue_integrations_provider_check;
alter table public.venue_integrations add constraint venue_integrations_provider_check
check (provider in ('iiko','quick_resto','r_keeper','saby_presto','yuma','poster','syrve','tillypad','evotor','frontol','frontpad','fast_operator','jowi','smarttouch','traktir','restik','paladin','parus_restaurant','kontur_market','onec'));

create index if not exists idx_venue_integrations_provider_status
on public.venue_integrations(provider,status);
