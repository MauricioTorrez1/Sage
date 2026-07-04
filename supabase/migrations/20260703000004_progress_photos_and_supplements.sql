-- Phase 6: progress photos with AI vision analysis + supplements.
-- Run AFTER 20260703000003.

-- Supplements (free text: "proteína en polvo, creatina 5g, multivitamínico").
-- Injected into the coach prompts so diet plans account for them.
alter table public.profiles
  add column supplements text check (char_length(supplements) <= 500);

-- Progress photos: metadata row per photo; the image itself lives in the
-- private progress-photos Storage bucket under <user_id>/<timestamp>.jpg.
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  -- Weight at the time of the photo, snapshotted from the profile.
  weight_kg numeric(5, 1),
  -- Claude's vision evaluation, filled in by the coach Edge Function.
  analysis text,
  created_at timestamptz not null default now()
);

create index progress_photos_user_created_idx
  on public.progress_photos (user_id, created_at desc);

alter table public.progress_photos enable row level security;

create policy "Users can view own progress photos"
  on public.progress_photos for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own progress photos"
  on public.progress_photos for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own progress photos"
  on public.progress_photos for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own progress photos"
  on public.progress_photos for delete
  using ((select auth.uid()) = user_id);

-- Private Storage bucket; each user can only touch their own folder.
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false);

create policy "Users can view own photo files"
  on storage.objects for select
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload own photo files"
  on storage.objects for insert
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete own photo files"
  on storage.objects for delete
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
