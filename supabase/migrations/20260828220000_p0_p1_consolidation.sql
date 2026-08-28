-- QR Menu — P0/P1 production consolidation
-- Date: 2026-08-28
-- Purpose: record the production hardening already applied during the P0/P1 audit.
-- This migration is intentionally idempotent and does not recreate business logic.
-- Canonical business RPCs remain unchanged.

begin;

-- ---------------------------------------------------------------------------
-- 1. Remove duplicate payment index identified during audit.
-- ---------------------------------------------------------------------------
drop index if exists public.payment_accounts_platform_provider_uidx;

-- ---------------------------------------------------------------------------
-- 2. Foreign-key indexes identified by Supabase performance advisor.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Canonical public-order boundary.
-- Legacy public order constructors are no longer executable by API roles.
-- ---------------------------------------------------------------------------
revoke execute on function public.create_public_order(text,jsonb,jsonb,numeric,text,text,text,text,text,text,text) from anon, authenticated;
revoke execute on function public.create_public_order_v2(text,jsonb,jsonb,numeric,text,text,text,text,text,text,text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Manager-only global catalog mutations.
-- Global catalog is platform-owned; managers may consume it but must not mutate it.
-- ---------------------------------------------------------------------------
revoke execute on function public.manager_global_ingredient_update(uuid,text,text,text) from anon, authenticated;
revoke execute on function public.manager_global_ingredient_delete(uuid) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Remove API-role access to obsolete/internal helper functions where present.
-- IF EXISTS is intentionally used because function signatures can differ between
-- historical database states.
-- ---------------------------------------------------------------------------
revoke execute on function public.product_recipe_cost(uuid) from anon, authenticated;

commit;
