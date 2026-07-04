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
| AI coach chat: profile + today's plan + latest photo analysis as context | ✅ Done (RAG pending) |
| Progress photos: Claude vision compare, private bucket + RLS, delete | ✅ Done |
| Dark/light mode (manual toggle) + animated brand shapes | ✅ Done |
| Optional donations (env-gated link, never blocks anything) | ✅ Done |
| CI: lint + typecheck on every push | ✅ Done |
| Diet data: Open Food Facts + barcode + shopping list | ⏳ Planned |
| Workout data: wger exercise images/instructions | ⏳ Planned |
| Coach RAG: pgvector + Voyage AI embeddings + source citations | ⏳ Planned |
| Food photo → structured JSON log (ephemeral, consent-first) | ⏳ Planned |
| Progress screen: adherence rings, weight trend, streaks, celebrations | ✅ Done |
| Reminders | ⏳ Planned (local only — Expo Go dropped remote push) |
| Weekly check-in with feedback + safe plan adjustment | ⏳ Planned |
| Chat streaming, portfolio README, EAS build guide | ⏳ Planned |

### Next phases (11–18)

Planned order for the remaining work, sequenced by dependencies and demo value:

| Phase | Scope |
|---|---|
| 11 | ✅ Full progress screen: meal/exercise adherence rings (Apple Fitness style), weight trend, streaks, celebrations — adherence is computed straight from `daily_plans.items`, so no extra log table was needed. Also: the daily-plan prompt now sees the last week's meal titles to keep dishes varied |
| 12 | Diet data: Open Food Facts + barcode scanning + shopping list fitted to the weekly budget. Plus: training-equipment picker (what gear the user has at home/gym) so daily plans only prescribe exercises the equipment allows |
| 13 | Workout data: wger exercise images/instructions, excluding moves contraindicated by injuries |
| 14 | Coach RAG: pgvector + Voyage AI `voyage-3.5` embeddings (1024 dims, `match_knowledge_chunks`) + source citations |
| 15 | Food photo → structured JSON log with `claude-haiku-4-5` (ephemeral, consent-first, zod-validated) |
| 16 | Local reminders with Expo Notifications (Expo Go dropped remote push) |
| 17 | Weekly check-in: `weekly_reviews` table, opt-in photo comparison, RAG + adherence feedback, safe plan adjustment, body-image guardrails — last because it consumes 11 and 14 |
| 18 | Launch polish: Google OAuth, coach chat streaming, portfolio README (screenshots + GIF + architecture diagram + lessons learned), EAS Build guide |

## Health disclaimer

Sage provides general wellness guidance, **not medical advice**. Always consult a health professional.

## License

[MIT](LICENSE)
