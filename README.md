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
| Progress screen: adherence rings, weight trend, streaks, celebrations | ⏳ Planned |
| Reminders | ⏳ Planned (local only — Expo Go dropped remote push) |
| Weekly check-in with feedback + safe plan adjustment | ⏳ Planned |
| Chat streaming, portfolio README, EAS build guide | ⏳ Planned |

## Health disclaimer

Sage provides general wellness guidance, **not medical advice**. Always consult a health professional.

## License

[MIT](LICENSE)
