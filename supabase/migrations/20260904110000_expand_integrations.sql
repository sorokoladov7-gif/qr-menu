-- Expand provider registry for restaurant POS/accounting systems.
alter table public.venue_integrations drop constraint if exists venue_integrations_provider_check;
alter table public.venue_integrations add constraint venue_integrations_provider_check
check (provider in ('iiko','quick_resto','r_keeper','poster','evotor','onec','tillypad','frontol'));
