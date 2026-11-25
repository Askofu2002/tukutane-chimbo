-- Tukutane Chimbo feature migration.
-- Apply this in Supabase SQL Editor after the initial schema.
-- It adds secure conversation creation/listing and admin reporting RPCs.
create or replace function public.start_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if target_user is null or target_user = current_user_id then raise exception 'Invalid member'; end if;
  if not exists (select 1 from public.profiles where id=current_user_id and registration_complete) then
    raise exception 'Complete your profile first';
  end if;
  if not exists (select 1 from public.profiles where id=target_user and registration_complete) then
    raise exception 'Member profile is not available';
  end if;
  if exists (
    select 1 from public.user_blocks
    where (blocker_id=current_user_id and blocked_id=target_user)
       or (blocker_id=target_user and blocked_id=current_user_id)
  ) then raise exception 'Messaging is unavailable for this member'; end if;

  select c.id into existing_id
  from public.conversations c
  where exists (select 1 from public.conversation_members a where a.conversation_id=c.id and a.user_id=current_user_id)
    and exists (select 1 from public.conversation_members b where b.conversation_id=c.id and b.user_id=target_user)
    and (select count(*) from public.conversation_members x where x.conversation_id=c.id)=2
  order by c.created_at desc limit 1;

  if existing_id is not null then return existing_id; end if;
  insert into public.conversations default values returning id into new_id;
  insert into public.conversation_members(conversation_id,user_id)
  values (new_id,current_user_id),(new_id,target_user);
  return new_id;
end;
$$;

create or replace function public.list_my_conversations()
returns table (
  conversation_id uuid,
  other_user_id uuid,
  other_display_name text,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id,
         other_member.user_id,
         coalesce(p.display_name,'Tukutane member'),
         latest.body,
         coalesce(latest.created_at,c.created_at)
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id=c.id and mine.user_id=auth.uid()
  join public.conversation_members other_member
    on other_member.conversation_id=c.id and other_member.user_id<>auth.uid()
  join public.profiles p on p.id=other_member.user_id
  left join lateral (
    select m.body,m.created_at from public.messages m
    where m.conversation_id=c.id order by m.created_at desc limit 1
  ) latest on true
  order by coalesce(latest.created_at,c.created_at) desc;
$$;

create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'askofutza41@gmail.com' then
    raise exception 'Administrator access required';
  end if;
  return jsonb_build_object(
    'members',(select count(*) from public.profiles),
    'completed_profiles',(select count(*) from public.profiles where registration_complete),
    'active_memberships',(select count(*) from public.memberships where status='active' and ends_at>now()),
    'successful_revenue_tzs',(select coalesce(sum(amount_tzs),0) from public.payment_transactions where status='successful'),
    'pending_payments',(select count(*) from public.payment_transactions where status='pending'),
    'open_reports',(select count(*) from public.user_reports where status='open')
  );
end;
$$;

create or replace function public.admin_recent_payments()
returns table (
  member_name text, phone text, amount_tzs integer, merchant_reference text,
  provider_reference text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'askofutza41@gmail.com' then
    raise exception 'Administrator access required';
  end if;
  return query
    select coalesce(p.display_name,'Member'),p.phone,t.amount_tzs,t.merchant_reference,
           t.provider_reference,t.status,t.created_at
    from public.payment_transactions t
    join public.profiles p on p.id=t.user_id
    order by t.created_at desc limit 100;
end;
$$;

create or replace function public.admin_open_reports()
returns table (
  report_id uuid, reporter_name text, reported_name text, reason text,
  details text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'askofutza41@gmail.com' then
    raise exception 'Administrator access required';
  end if;
  return query
    select r.id,coalesce(a.display_name,'Member'),coalesce(b.display_name,'Member'),
           r.reason,r.details,r.status,r.created_at
    from public.user_reports r
    join public.profiles a on a.id=r.reporter_id
    join public.profiles b on b.id=r.reported_user_id
    order by r.created_at desc limit 100;
end;
$$;

create or replace function public.admin_update_report(target_report uuid,new_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if lower(coalesce(auth.jwt()->>'email','')) <> 'askofutza41@gmail.com' then
    raise exception 'Administrator access required';
  end if;
  if new_status not in ('open','reviewing','resolved','dismissed') then
    raise exception 'Invalid report status';
  end if;
  update public.user_reports set status=new_status where id=target_report;
end;
$$;

revoke all on function public.start_conversation(uuid) from public;
revoke all on function public.list_my_conversations() from public;
revoke all on function public.admin_dashboard_summary() from public;
revoke all on function public.admin_recent_payments() from public;
revoke all on function public.admin_open_reports() from public;
revoke all on function public.admin_update_report(uuid,text) from public;
grant execute on function public.start_conversation(uuid) to authenticated;
grant execute on function public.list_my_conversations() to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_recent_payments() to authenticated;
grant execute on function public.admin_open_reports() to authenticated;
grant execute on function public.admin_update_report(uuid,text) to authenticated;

-- Restrict photo object access to the owner or photos attached to a completed
-- member profile. This replaces the initial overly broad authenticated-read policy.
drop policy if exists "profile_photo_storage_read_authenticated" on storage.objects;
create policy "profile_photo_storage_read_members" on storage.objects
for select to authenticated
using (
  bucket_id='profile-photos'
  and (
    (storage.foldername(name))[1]=auth.uid()::text
    or exists (
      select 1 from public.profile_photos pp
      join public.profiles p on p.id=pp.user_id
      where pp.storage_path=name and p.registration_complete=true
    )
  )
);

-- Keep profile phone numbers out of the discovery query in the client.
-- Existing table RLS is unchanged; the app should only select phone for its own profile.
