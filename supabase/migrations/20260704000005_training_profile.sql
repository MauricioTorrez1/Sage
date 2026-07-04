-- Phase 10: full onboarding — body type, training availability/place,
-- weekly food budget and injuries, so plans and the coach can honor them.
-- Run AFTER 20260703000004.

alter table public.profiles
  add column body_type text
    check (body_type in ('ectomorph', 'mesomorph', 'endomorph')),
  add column training_minutes_per_day integer
    check (training_minutes_per_day between 10 and 300),
  add column training_days_per_week integer
    check (training_days_per_week between 1 and 7),
  add column training_place text
    check (training_place in ('home', 'gym')),
  -- Weekly food budget in MXN; null = not specified.
  add column weekly_food_budget_mxn integer
    check (weekly_food_budget_mxn between 100 and 50000),
  -- Free text: injuries or physical limitations the plans must respect.
  add column injuries text check (char_length(injuries) <= 500);
