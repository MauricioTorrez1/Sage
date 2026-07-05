-- Phase 13: server-side AI generation limits + progress photo poses.
-- Run AFTER 20260704000006.

-- One row per successful AI generation. The coach function counts rows in
-- a rolling 24h window (server clock) to enforce 3/day per kind, so
-- changing the device clock cannot bypass the limit.
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('daily_plan', 'shopping_list')),
  created_at timestamptz not null default now()
);

create index ai_generations_user_kind_created_idx
  on public.ai_generations (user_id, kind, created_at desc);

alter table public.ai_generations enable row level security;

create policy "Users can view own generations"
  on public.ai_generations for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own generations"
  on public.ai_generations for insert
  with check ((select auth.uid()) = user_id);

-- Photo pose: front / back / side. Older photos (null) count as front.
alter table public.progress_photos
  add column pose text check (pose in ('front', 'back', 'side'));
