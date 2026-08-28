-- QR Menu — P0/P1 production consolidation
-- Date: 2026-08-28
-- Purpose: record the production hardening already applied during the P0/P1 audit.
-- Idempotent; preserves the existing canonical business API.

begin;

drop index if exists public.payment_accounts_platform_provider_uidx;

create index if not exists manager_tech_cards_created_by_idx
  on public.manager_tech_cards (created_by);
create index if not exists payment_oauth_states_manager_id_idx
  on public.payment_oauth_states (manager_id);
create index if not exists payment_oauth_states_venue_id_idx
  on public.payment_oauth_states (venue_id);
create index if not exists payment_transactions_manager_id_idx
  on public.payment_transactions (manager_id);
create index if not exists payment_transactions_payment_account_id_idx
  on public.payment_transactions (payment_account_id);

revoke execute on function public.create_public_order(uuid,text,text,text,text,text,text,jsonb,jsonb,numeric,text,numeric) from anon, authenticated;
revoke execute on function public.create_public_order_v2(uuid,text,text,text,text,text,text,jsonb,jsonb,text,double precision,double precision,text) from anon, authenticated;
revoke execute on function public.manager_global_ingredient_update(uuid,text,text,text) from anon, authenticated;
revoke execute on function public.manager_global_ingredient_delete(uuid) from anon, authenticated;
revoke execute on function public.product_recipe_cost(uuid) from anon, authenticated;

commit;
