-- Membership already has presence SELECT/INSERT on this private topic.
-- Keep cursor messages separate from the server-owned world revision channel.
-- Supabase owns realtime.messages and its RLS switch; supported policy edits only.
create policy memory_box_receive_cursors on realtime.messages
for select to authenticated
using ((select realtime.topic()) = 'world:commons:presence' and extension = 'broadcast');

create policy memory_box_send_cursors on realtime.messages
for insert to authenticated
with check ((select realtime.topic()) = 'world:commons:presence' and extension = 'broadcast');
