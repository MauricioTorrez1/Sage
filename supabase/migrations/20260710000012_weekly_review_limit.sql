-- Phase 19: check-in generations counted toward a weekly cap (2/week, resets
-- Sunday). Run AFTER 20260710000011.

-- 'weekly_review' must be an allowed generation kind so the coach function can
-- record and count check-in generations per Sunday-anchored week.
alter table public.ai_generations
  drop constraint ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in ('daily_plan', 'shopping_list', 'food_photo', 'weekly_review'));
