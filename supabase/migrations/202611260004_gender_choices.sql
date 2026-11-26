-- Tukutane Chimbo: restrict profile gender choices to Male and Female.
-- Apply this migration in Supabase SQL Editor after migration 003.
create or replace function public.save_my_profile(
  p_display_name text,
  p_phone text,
  p_gender text,
  p_region text,
  p_bio text,
  p_language text default 'sw'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  saved_profile jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if nullif(trim(coalesce(p_display_name,'')),'') is null then
    raise exception 'Display name is required';
  end if;
  if p_gender is null or p_gender not in ('female','male') then
    raise exception 'Choose Male or Female';
  end if;

  insert into public.profiles
    (id,display_name,phone,gender,region,bio,language)
  values
    (current_user_id,trim(p_display_name),nullif(trim(coalesce(p_phone,'')),''),p_gender,
     nullif(trim(coalesce(p_region,'')),''),nullif(trim(coalesce(p_bio,'')),''),coalesce(p_language,'sw'))
  on conflict (id) do update set
    display_name=excluded.display_name,
    phone=excluded.phone,
    gender=excluded.gender,
    region=excluded.region,
    bio=excluded.bio,
    language=excluded.language,
    updated_at=now()
  returning to_jsonb(profiles) into saved_profile;

  return saved_profile;
end;
$$;

revoke all on function public.save_my_profile(text,text,text,text,text,text) from public;
grant execute on function public.save_my_profile(text,text,text,text,text,text) to authenticated;
