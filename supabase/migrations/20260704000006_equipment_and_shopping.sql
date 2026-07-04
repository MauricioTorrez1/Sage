-- Phase 12: training equipment on the profile + weekly shopping lists.
-- Run AFTER 20260704000005.

-- What gear the user actually has (multi-select). Daily plans must only
-- prescribe exercises doable with this equipment; bodyweight always counts.
alter table public.profiles
  add column training_equipment text[]
    check (
      training_equipment <@ array[
        'none',
        'dumbbells',
        'barbell',
        'bench',
        'resistance_bands',
        'pull_up_bar',
        'kettlebell',
        'cardio_machine',
        'full_gym'
      ]::text[]
    );

-- One AI-generated shopping list per user per week (week_start = Monday).
-- items: [{ id, title, quantity, est_mxn, done }]
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.shopping_lists enable row level security;

create policy "Users can view own shopping lists"
  on public.shopping_lists for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own shopping lists"
  on public.shopping_lists for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own shopping lists"
  on public.shopping_lists for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own shopping lists"
  on public.shopping_lists for delete
  using ((select auth.uid()) = user_id);
