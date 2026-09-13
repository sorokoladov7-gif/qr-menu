begin;

revoke execute on function public.smart_table_close_guest_sessions() from anon, authenticated;

create index if not exists manager_ingredient_catalog_hidden_hidden_by_idx on public.manager_ingredient_catalog_hidden(hidden_by);
create index if not exists manager_recipe_catalog_hidden_hidden_by_idx on public.manager_recipe_catalog_hidden(hidden_by);
create index if not exists manager_support_broadcasts_admin_id_idx on public.manager_support_broadcasts(admin_id);
create index if not exists manager_support_messages_sender_id_idx on public.manager_support_messages(sender_id);
create index if not exists manager_support_threads_venue_id_idx on public.manager_support_threads(venue_id);
create index if not exists table_service_requests_guest_id_idx on public.table_service_requests(guest_id);
create index if not exists table_shared_cart_items_assigned_guest_id_idx on public.table_shared_cart_items(assigned_guest_id);
create index if not exists table_shared_cart_items_guest_id_idx on public.table_shared_cart_items(guest_id);
create index if not exists table_shared_cart_items_product_id_idx on public.table_shared_cart_items(product_id);
create index if not exists table_split_claims_guest_id_idx on public.table_split_claims(guest_id);
create index if not exists table_split_claims_order_id_idx on public.table_split_claims(order_id);
create index if not exists venue_tables_assigned_waiter_id_idx on public.venue_tables(assigned_waiter_id);

commit;
