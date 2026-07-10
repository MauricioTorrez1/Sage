-- Phase 19: per-local-calendar-period generation caps. Run AFTER 20260705000009.
-- NOTE: migration ...0013 later relaxes this unique index to a plain one so
-- daily_plan can allow 2 generations/day (initial build + one regeneration).

-- daily_plan and shopping_list move from the rolling 3/24h window to one
-- generation per local calendar period. The coach function records the
-- client's local period key — the plan's date for daily_plan, the week's
-- Monday for shopping_list. food_photo keeps period_key null and stays on the
-- rolling 24h limiter.
alter table public.ai_generations
  add column period_key text;

-- One generation per (user, kind, period). Partial so rows without a period
-- (food_photo, and any pre-existing rows) are unaffected.
create unique index ai_generations_user_kind_period_idx
  on public.ai_generations (user_id, kind, period_key)
  where period_key is not null;
