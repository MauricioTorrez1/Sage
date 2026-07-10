-- Phase 19 (round 2): allow more than one generation per period so daily_plan
-- can do an initial build + one free regeneration (2/day). Run AFTER
-- 20260710000012.

-- The coach function now counts rows per (user, kind, period) against a cap
-- (daily_plan = 2, shopping_list = 1, weekly_review = 2), so the period index
-- must NOT be unique. Drop the unique index from ...0010 and recreate it plain.
drop index if exists ai_generations_user_kind_period_idx;

create index ai_generations_user_kind_period_idx
  on public.ai_generations (user_id, kind, period_key)
  where period_key is not null;
