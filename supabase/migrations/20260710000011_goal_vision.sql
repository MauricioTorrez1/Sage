-- Phase 19: optional "how I want to look" goal photo + phased plan.
-- Run AFTER 20260710000010.

-- One goal vision per user (upserted). The image lives in the private
-- goal-photos Storage bucket under <user_id>/goal.jpg; Sage fills in a
-- realistic assessment and a short/mid/long-term plan.
create table public.goal_vision (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  -- Sage's honest read of the goal vs the person's starting point.
  assessment text,
  -- Phased plan written by Sage: { short, mid, long }.
  plan jsonb,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.goal_vision enable row level security;

create policy "Users can view own goal vision"
  on public.goal_vision for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own goal vision"
  on public.goal_vision for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own goal vision"
  on public.goal_vision for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own goal vision"
  on public.goal_vision for delete
  using ((select auth.uid()) = user_id);

-- Private Storage bucket; each user can only touch their own folder.
insert into storage.buckets (id, name, public)
values ('goal-photos', 'goal-photos', false);

create policy "Users can view own goal files"
  on storage.objects for select
  using (
    bucket_id = 'goal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload own goal files"
  on storage.objects for insert
  with check (
    bucket_id = 'goal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Upsert overwrites goal.jpg, so uploads need the update policy too.
create policy "Users can update own goal files"
  on storage.objects for update
  using (
    bucket_id = 'goal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete own goal files"
  on storage.objects for delete
  using (
    bucket_id = 'goal-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
