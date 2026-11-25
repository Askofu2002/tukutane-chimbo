create extension if not exists pgcrypto;
create type public.member_gender as enum ('male','female','other');
create type public.payment_status as enum ('pending','successful','failed','cancelled');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, phone text unique not null, gender public.member_gender not null,
 region text not null, about text default '', registration_complete boolean default false,
 is_admin boolean default false, created_at timestamptz default now()
);
create table public.profile_photos (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade,
 storage_path text not null, position int not null check(position between 1 and 3), created_at timestamptz default now(),
 unique(user_id,position), unique(storage_path)
);
create table public.conversations(id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.conversation_members(conversation_id uuid references conversations(id) on delete cascade,user_id uuid references profiles(id) on delete cascade,primary key(conversation_id,user_id));
create table public.blocks(blocker_id uuid references profiles(id) on delete cascade,blocked_id uuid references profiles(id) on delete cascade,created_at timestamptz default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id));
create table public.reports(id uuid primary key default gen_random_uuid(),reporter_id uuid references profiles(id) on delete cascade,reported_id uuid references profiles(id) on delete cascade,reason text not null,details text,created_at timestamptz default now());
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references conversations(id) on delete cascade,sender_id uuid references profiles(id) on delete cascade,body text not null check(length(body) between 1 and 4000),created_at timestamptz default now());
create table public.payments(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,amount_tzs int not null check(amount_tzs=1000),provider text not null check(provider='azampay'),reference text unique not null,provider_reference text,status public.payment_status default 'pending',created_at timestamptz default now(),verified_at timestamptz);
create table public.memberships(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,payment_id uuid references payments(id),starts_at timestamptz not null,ends_at timestamptz not null,created_at timestamptz default now(),check(ends_at>starts_at));
create table public.withdrawals(id uuid primary key default gen_random_uuid(),requested_by uuid references profiles(id),amount_tzs int not null check(amount_tzs>0),phone text not null,status text default 'pending',provider_reference text,created_at timestamptz default now());
alter table profiles enable row level security; alter table profile_photos enable row level security; alter table conversations enable row level security; alter table conversation_members enable row level security; alter table messages enable row level security; alter table blocks enable row level security; alter table reports enable row level security; alter table payments enable row level security; alter table memberships enable row level security; alter table withdrawals enable row level security;
create policy "profiles readable to authenticated" on profiles for select to authenticated using (true);
create policy "users insert own profile" on profiles for insert to authenticated with check(id=auth.uid());
create policy "users update own profile" on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "photos visible to authenticated" on profile_photos for select to authenticated using(true);
create policy "users manage own photos" on profile_photos for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "members see own conversations" on conversation_members for select to authenticated using(user_id=auth.uid());
create policy "members see conversation" on conversations for select to authenticated using(exists(select 1 from conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()));
create policy "members see messages" on messages for select to authenticated using(exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "members send messages" on messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()));
create policy "users manage own blocks" on blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create policy "users report" on reports for insert to authenticated with check(reporter_id=auth.uid());
create policy "users view own payments" on payments for select to authenticated using(user_id=auth.uid());
create policy "users view own membership" on memberships for select to authenticated using(user_id=auth.uid());
create policy "admin view withdrawals" on withdrawals for select to authenticated using(exists(select 1 from profiles p where p.id=auth.uid() and p.is_admin));
create policy "user request withdrawal" on withdrawals for insert to authenticated with check(requested_by=auth.uid());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-photos','profile-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "profile photos public read" on storage.objects for select using(bucket_id='profile-photos');
create policy "upload own profile photos" on storage.objects for insert to authenticated with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "update own profile photos" on storage.objects for update to authenticated using(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
-- Admin must be promoted manually by trusted SQL after account creation.
-- Enable Realtime for public.messages in the Supabase dashboard.
