# Sage 🌿

**AI-powered nutrition and personal training coach.** Warm, calm and motivating — built to inspire consistency, never guilt.

> 🚧 **Work in progress** — Phase 10 of the build. See the progress table below.

## Stack

- **React Native + Expo (SDK 54) + TypeScript (strict)** — SDK 54 is the newest version supported by Expo Go on the iOS App Store
- **Expo Router** — file-based navigation
- **NativeWind v4** (Tailwind for RN) + **Reanimated** for animations
- **Supabase** — Auth, Postgres (RLS), Storage, pgvector for RAG _(upcoming)_
- **Claude API** (claude-sonnet-5) for diet/workout generation, coaching and photo analysis; **Voyage AI** for embeddings _(upcoming)_
- **i18next** — Spanish (es-MX) first, English planned

## Getting started

```bash
npm install
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your phone (same Wi-Fi network).

## Project structure

```
src/
  app/          # Routes (Expo Router)
  components/   # Reusable UI
  features/     # auth, onboarding, diet, workout, coach, progress
  lib/          # supabase client, LLM provider, external APIs, RAG, i18n
  theme/        # Design tokens (single source of truth)
  hooks/
  types/
supabase/       # SQL migrations, Edge Functions
```

## Progress vs. original plan

Updated at the end of every phase.

| Area (original plan) | Status |
|---|---|
| Setup: Expo + NativeWind + design tokens + welcome screen | ✅ Done |
| Auth: Supabase email + password, recovery, RLS | ✅ Done (Google OAuth pending) |
| Onboarding & profile: physical data, body type, goal, training time/place, budget, allergies, injuries, supplements + TDEE (Mifflin-St Jeor) | ✅ Done |
| AI daily plan: personalized meals + workout checklist, honors profile, partial regeneration (completed items stay) | ✅ Done |
| AI coach chat: profile + today's plan + latest photo analysis as context | ✅ Done |
| Progress photos: Claude vision compare, private bucket + RLS, delete | ✅ Done |
| Dark/light mode (manual toggle) + animated brand shapes | ✅ Done |
| Optional donations (env-gated link, never blocks anything) | ✅ Done |
| CI: lint + typecheck on every push | ✅ Done |
| Diet data: Open Food Facts + barcode + shopping list | ✅ Done |
| Workout data: wger exercise images/instructions | ✅ Done (curated local catalog — wger's search API was removed) |
| Coach RAG: pgvector + Voyage AI embeddings + source citations | ✅ Done (curated knowledge base in `supabase/knowledge/`, ingested by `scripts/ingest-knowledge.mjs`; chat degrades gracefully without `VOYAGE_API_KEY`) |
| Food photo → structured JSON log (ephemeral, consent-first) | ✅ Done (claude-sonnet-5 — Haiku misread desserts as savory dishes; the image is never stored) |
| Progress screen: adherence rings, weight trend, streaks, celebrations | ✅ Done |
| Reminders | ✅ Done (local notifications; prefs on device, schedule lives in the OS) |
| Weekly check-in with feedback + safe plan adjustment | ✅ Done (`weekly_reviews` table; adherence recap + RAG feedback + one safe tweak, body-image guardrails, opt-in photo context) |
| Chat streaming, portfolio README, EAS build guide | ⏳ Planned |

### Next phases (11–18)

Planned order for the remaining work, sequenced by dependencies and demo value:

| Phase | Scope |
|---|---|
| 11 | ✅ Full progress screen: meal/exercise adherence rings (Apple Fitness style), weight trend, streaks, celebrations — adherence is computed straight from `daily_plans.items`, so no extra log table was needed. Also: the daily-plan prompt now sees the last week's meal titles to keep dishes varied |
| 12 | ✅ Diet data: Open Food Facts + barcode scanning (expo-camera) + AI weekly shopping list fitted to the budget (`shopping_lists` table). Plus the training-equipment picker: multi-select chips on onboarding/profile (`profiles.training_equipment`), and daily plans only prescribe exercises the equipment allows |
| 13 | ✅ Workout data: tap ⓘ on any plan exercise for a wger sheet (image + instructions, Spanish first). wger removed its search API, so titles match against a curated local catalog of verified IDs. Also shipped: server-clock generation limits (3/day for plans and shopping lists — device clock changes can't bypass it), the shared progress bar on the shopping list, and progress photos by pose (front/back/side; analysis compares same-pose photos) |
| 14 | ✅ Coach RAG (pgvector + Voyage AI `voyage-3.5`, 1024 dims, `match_knowledge_chunks`, source citations) + food photo → structured log with `claude-haiku-4-5` (ephemeral, consent-first) + wger catalog equipment variants + modal safe-area fix |
| 15 | ~~Food photo~~ (shipped early, in 14) |
| 16 | ✅ Local reminders with Expo Notifications (Expo Go dropped remote push): morning/evening toggles + hour stepper on the profile screen, prefs in AsyncStorage, schedule owned by the OS. Also: food photo moved to claude-sonnet-5 with quality 0.7 (Haiku at 0.4 misread a strawberry cheesecake as ham) |
| 17 | ✅ Weekly check-in (`weekly_reviews` table): adherence recap from the week's `daily_plans`, RAG-backed feedback, one small safe plan tweak, body-image guardrails, opt-in progress-photo context — lives on the progress screen. Shipped alongside four refinements: **(a)** logging a food photo now recalculates the day server-side (`log_food` mode) — the eaten meal is discounted from the calorie target and the still-unchecked meals are rebuilt around it, keeping completed meals and all exercises; **(b)** food-photo scans now count toward the 3/day server-side limit; **(c)** the shopping list lets you delete scanned products, and regeneration keeps checked + scanned items and only rebuilds the rest within the remaining budget; **(d)** reminders now pick hour **and** minute |
| 18 | Launch polish: Google OAuth, coach chat streaming, portfolio README (screenshots + GIF + architecture diagram + lessons learned), EAS Build guide |

## Health disclaimer

Sage provides general wellness guidance, **not medical advice**. Always consult a health professional.

## License

[MIT](LICENSE)
