-- Phase 5b: free-text food notes (allergies, restrictions, budget, tastes).
-- Injected into the coach prompts; free text suits an LLM better than
-- over-modeled columns. Run AFTER 20260703000002.

alter table public.profiles
  add column food_notes text check (char_length(food_notes) <= 500);
