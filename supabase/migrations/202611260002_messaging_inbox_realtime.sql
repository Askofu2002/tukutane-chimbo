-- Tukutane Chimbo messaging inbox realtime migration.
-- Apply after 202611260001_app_features.sql in Supabase SQL Editor.
-- Conversation creation/listing and message RLS are installed by migration 001.
-- This publishes membership inserts so a recipient's inbox updates as soon as
-- another member starts a conversation with them.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='conversation_members'
    ) then
      alter publication supabase_realtime add table public.conversation_members;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end
$$;

grant usage on schema public to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
