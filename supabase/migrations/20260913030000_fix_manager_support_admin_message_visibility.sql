begin;

-- Managers must be able to read both their own messages and administrator replies.
drop policy if exists manager_support_messages_manager on public.manager_support_messages;

create policy manager_support_messages_manager
on public.manager_support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.manager_support_threads t
    where t.id = manager_support_messages.thread_id
      and t.manager_id = auth.uid()
  )
);

commit;
