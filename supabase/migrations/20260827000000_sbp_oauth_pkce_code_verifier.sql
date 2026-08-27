-- SBP/YooKassa OAuth: store the PKCE code_verifier created at /connect so the
-- /callback code->token exchange can send it back. Nullable and additive, so
-- existing rows and the current flow keep working if this is not applied yet.
alter table public.payment_oauth_states add column if not exists code_verifier text;
