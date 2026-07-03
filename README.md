# Sage 🌿

**AI-powered nutrition and personal training coach.** Warm, calm and motivating — built to inspire consistency, never guilt.

> 🚧 **Work in progress** — currently at Phase 0 (project setup + brand foundation). See the roadmap below.

## Stack

- **React Native + Expo (SDK 54) + TypeScript (strict)** — SDK 54 is the newest version supported by Expo Go on the iOS App Store
- **Expo Router** — file-based navigation
- **NativeWind v4** (Tailwind for RN) + **Reanimated** for animations
- **Supabase** — Auth, Postgres (RLS), Storage, pgvector for RAG _(upcoming)_
- **Claude API** (Sonnet + Haiku) for diet/workout generation, coaching and photo analysis; **Voyage AI** for embeddings _(upcoming)_
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

## Roadmap

- [x] **Phase 0** — Setup: Expo + NativeWind + design tokens + welcome screen
- [ ] **Phase 1** — Auth (Supabase, email + Google OAuth, RLS)
- [ ] **Phase 2** — Onboarding & profile (TDEE calculation)
- [ ] **Phase 3** — AI diet generator + Open Food Facts + shopping list
- [ ] **Phase 4** — AI workout generator (wger exercise database)
- [ ] **Phase 5** — AI coach with RAG (pgvector + Voyage AI + Claude)
- [ ] **Phase 6** — Photo analysis (Claude vision, privacy-first)
- [ ] **Phase 7** — Streaks, reminders, progress & adherence rings
- [ ] **Phase 8** — Weekly check-in with feedback and plan adjustment
- [ ] **Phase 9** — Optional donations

## Health disclaimer

Sage provides general wellness guidance, **not medical advice**. Always consult a health professional.

## License

[MIT](LICENSE)
