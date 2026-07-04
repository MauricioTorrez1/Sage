-- Phase 5: persistent chat history + Sage-generated daily plans.
-- Apply via Supabase Dashboard > SQL Editor (see supabase/README.md).

-- Chat history: written by the coach Edge Function (RLS-scoped as the user).
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy "Users can view own messages"
  on public.chat_messages for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own messages"
  on public.chat_messages for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own messages"
  on public.chat_messages for delete
  using ((select auth.uid()) = user_id);

-- Daily plans: one row per user per local date. items is a jsonb array of
-- { id, kind: 'meal'|'exercise', title, detail, kcal?, done } written by the
-- Edge Function on generation and updated by the app when checking items off.
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

alter table public.daily_plans enable row level security;

create policy "Users can view own daily plans"
  on public.daily_plans for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert own daily plans"
  on public.daily_plans for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update own daily plans"
  on public.daily_plans for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger daily_plans_set_updated_at
  before update on public.daily_plans
  for each row execute function public.set_updated_at();
