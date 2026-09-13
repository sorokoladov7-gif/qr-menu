begin;

create index if not exists manager_support_messages_unread_idx
  on public.manager_support_messages(thread_id, created_at desc)
  where sender_role='manager' and read_at is null;

commit;
