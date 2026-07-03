-- Phase 2: user profiles.
-- One row per auth user, created automatically on signup.
-- Apply via Supabase Dashboard > SQL Editor (or `supabase db push` if using the CLI).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  age int check (age between 13 and 120),
  sex text check (sex in ('male', 'female')),
  height_cm int check (height_cm between 90 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  activity_level text check (
    activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')
  ),
  goal text check (goal in ('lose_weight', 'maintain', 'gain_muscle')),
  -- Set once the onboarding wizard finishes; the app gates on this.
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Keep updated_at fresh on every write.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create an empty profile when a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
