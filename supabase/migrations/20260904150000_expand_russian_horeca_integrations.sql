-- QR Menu: expanded Russian HoReCa integration registry.
-- This migration registers providers in the shared integration layer.
-- Adapters are enabled only when their backend implementation is ready.

alter table public.venue_integrations drop constraint if exists venue_integrations_provider_check;
alter table public.venue_integrations add constraint venue_integrations_provider_check
check (provider in (
  'iiko','quick_resto','r_keeper','poster','evotor','onec','tillypad','frontol',
  'saby_presto','yuma','syrve','jowi','traktir','kontur_market','restik',
  'parus_restaurant','paladin','smarttouch','frontpad','fast_operator'
));

comment on column public.venue_integrations.provider is
  'POS/accounting provider. Russian HoReCa registry: iiko, Quick Resto, r_keeper, Poster, Evotor, 1C, Tillypad, Frontol, Saby Presto, YUMA, Syrve, Jowi, Traktir, Kontur Market, Restik, Parus Restaurant, Paladin, SmartTouch, FrontPad, Fast Operator.';
