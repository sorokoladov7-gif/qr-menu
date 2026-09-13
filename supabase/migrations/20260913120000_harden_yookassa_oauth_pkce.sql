begin;

alter table public.payment_oauth_states
  add column if not exists code_verifier text;

comment on column public.payment_oauth_states.code_verifier is
  'Temporary OAuth PKCE verifier. Rows expire quickly and are marked consumed after callback.';

commit;
