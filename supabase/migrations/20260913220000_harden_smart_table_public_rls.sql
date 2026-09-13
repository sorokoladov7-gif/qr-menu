begin;

-- Smart Table storage is accessed through SECURITY DEFINER RPCs only.
-- Direct PostgREST table access must not expose guest/session/cart/request data.
alter table public.table_guest_sessions enable row level security;
alter table public.table_shared_cart_items enable row level security;
alter table public.table_service_requests enable row level security;
alter table public.table_split_claims enable row level security;
alter table public.venue_promotions enable row level security;

revoke all on table public.table_guest_sessions from anon, authenticated;
revoke all on table public.table_shared_cart_items from anon, authenticated;
revoke all on table public.table_service_requests from anon, authenticated;
revoke all on table public.table_split_claims from anon, authenticated;
revoke all on table public.venue_promotions from anon, authenticated;

commit;
