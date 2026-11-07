-- Iron 75 database. Paste this whole file into Supabase → SQL Editor → New query, then click Run.
-- Safe to run more than once.
-- Every table is protected by Row Level Security: each signed-in person can only read and write their own rows.

-- ---------- Profiles: one row per person, holds settings, equipment, program and targets ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Daily log: habits, water, weight, sleep, notes, measurements ----------
create table if not exists public.day_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- Food diary: one row per logged food ----------
create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('b','l','d','s')),
  name text not null,
  brand text,
  source text,            -- usda, off, usda_branded, custom, recipe, quick
  source_id text,
  amount numeric not null,
  unit text not null,     -- 'g', 'serving', or a portion label
  grams numeric,          -- grams eaten when known
  nutrients jsonb not null, -- totals for this entry: kcal, p, c, f, fib, sug, na, ... micronutrients
  basis jsonb,            -- per-100 g / per-serving values and portions, so the food can be re-logged exactly
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.food_entries add column if not exists basis jsonb;
create index if not exists food_entries_user_date on public.food_entries(user_id, date);

-- ---------- Custom foods and recipes ----------
create table if not exists public.custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'food' check (kind in ('food','recipe','meal')),
  name text not null,
  brand text,
  barcode text,
  serving text not null default '1 serving',
  grams numeric,          -- grams per serving when known
  nutrients jsonb not null, -- per serving
  ingredients jsonb,      -- recipes and saved meals
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_foods_user on public.custom_foods(user_id);

-- ---------- Workouts: one row per person per day ----------
create table if not exists public.workouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  data jsonb not null default '{}'::jsonb,  -- session id, exercises with sets, notes, start/finish times
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- ---------- Custom routines (programs people build themselves) ----------
create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_user on public.routines(user_id);

-- ---------- Photos: progress and meal photos (files live in the private 'photos' storage bucket) ----------
create table if not exists public.photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('progress','meal')),
  slot text,              -- 'am' or 'pm' for progress photos
  meal text,
  path text not null,
  thumb_path text,
  created_at timestamptz not null default now()
);
create index if not exists photos_user_date on public.photos(user_id, date);

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  foreach t in array array['day_logs','food_entries','custom_foods','workouts','routines','photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Create a profile automatically when someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at current
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['profiles','day_logs','food_entries','custom_foods','workouts','routines'] loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------- Private photo storage: each person can only touch files in their own folder ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "photos: own folder read" on storage.objects;
drop policy if exists "photos: own folder insert" on storage.objects;
drop policy if exists "photos: own folder update" on storage.objects;
drop policy if exists "photos: own folder delete" on storage.objects;
create policy "photos: own folder read" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: own folder update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Let a person delete their own account and all of their data from inside the app.
-- The app removes their photo files through the Storage API first; table rows cascade.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
