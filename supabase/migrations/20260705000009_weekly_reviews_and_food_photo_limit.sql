-- Phase 17: weekly check-in + food-photo scans counted toward the daily limit.
-- Run AFTER 20260705000008.

-- Food-photo scans now share the server-side 3/day rolling-window limiter,
-- so 'food_photo' must be an allowed generation kind. Drop the old inline
-- check and recreate it with the extra value.
alter table public.ai_generations
  drop constraint ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in ('daily_plan', 'shopping_list', 'food_photo'));

-- One weekly check-in per user per week. Regenerating overwrites the row
-- (upsert on the unique key), so there is at most one review per week.
create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  -- Optional free-text note from the user on how the week felt.
  feeling text,
  -- Sage's written feedback for the week.
  summary text not null,
  -- Snapshot of the adherence that produced the summary (meals/exercises
  -- done vs planned across the week), kept so the UI can show it later.
  meals_done integer not null default 0,
  meals_total integer not null default 0,
  exercises_done integer not null default 0,
  exercises_total integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_reviews_user_week_idx
  on public.weekly_reviews (user_id, week_start desc);

alter table public.weekly_reviews enable row level security;

create policy "Users can view own weekly reviews"
  on public.weekly_reviews for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own weekly reviews"
  on public.weekly_reviews for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own weekly reviews"
  on public.weekly_reviews for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
