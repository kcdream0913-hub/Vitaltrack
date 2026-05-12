# VitalTrack — Sprint Report
**Generated:** May 2026  
**Repo:** github.com/kcdream0913-hub/Vitaltrack  
**Stack:** Next.js 14 · FastAPI · Supabase · Expo SDK 51 · Turborepo

---

## Current State Audit

| Layer | Status | Notes |
|---|---|---|
| Web — Dashboard | ⚠️ Partial | Mock/static data, hooks exist but not wired to live API |
| Web — Vitals | ✅ Built | TrendChart, type selector, date range, API hooks |
| Web — Medications | ✅ Built | Full CRUD with TanStack Query, adherence summary |
| Web — Analytics | ✅ Built | Health score rings, AI insights, alert banners |
| Web — Records | ✅ Built | 6-tab clinical hub (conditions, allergies, encounters, labs, immunizations, symptoms) |
| Web — Appointments | ❌ Placeholder | "Coming soon" — no backend router, no frontend CRUD |
| Web — Reports | ❌ Placeholder | "Coming soon" — no PDF generation |
| Web — Profile / Settings / Help | ❌ Missing | Pages don't exist yet |
| Backend — Vitals | ✅ Built | Wide-column model, VITAL_COLUMN_MAP, all endpoints |
| Backend — Medications | ✅ Built | CRUD + adherence summary endpoint |
| Backend — Analytics | ✅ Built | Health score, alerts, insight report |
| Backend — Clinical | ✅ Built | 29 routes across 6 domains (MediKeep integration) |
| Backend — Appointments | ❌ Missing | No router, no model, no migration |
| Backend — .env | ❌ Placeholder | DATABASE_URL, JWT_SECRET, SUPABASE_URL need real values |
| Supabase migrations | ⚠️ Pending | 7 migrations written, none applied (`supabase db push` not run) |
| Mobile — Expo scaffold | ✅ Built | 27 files, expo-router, all 6 screens, API client, auth |
| Mobile — Data wiring | ❌ Not started | Screens show static data; no API calls live |
| Mobile — Native build | ❌ Not started | `pnpm install` + `expo run` not done |
| Design — Mobile handoff | ✅ Done | `design-bundle/VitalTrack-Mobile-Handoff.html` |
| Design — Figma | ⚠️ Empty | File created, MCP quota exhausted — content pending |
| Tests | ❌ None | No unit, integration, or e2e tests written |
| CI/CD | ❌ None | No GitHub Actions workflows |
| Deployment | ❌ None | Not deployed anywhere |

---

## Sprint 1 — Live Foundation
**Duration:** 2 weeks  
**Goal:** Get the app running end-to-end with real data. No more mocks.

### 🔧 Infrastructure (Day 1–2)
| # | Task | Owner | Points |
|---|---|---|---|
| 1.1 | Fill in real Supabase credentials in `backend/.env` (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET_KEY) | Dev | 1 |
| 1.2 | Run `supabase db push` to apply all 7 migrations to production | Dev | 1 |
| 1.3 | Verify backend starts on port 8000 with no errors (fix zombie port conflict — restart machine or use `npx kill-port 8000`) | Dev | 1 |
| 1.4 | Set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` in `apps/web/.env.local` | Dev | 1 |
| 1.5 | Run `pnpm install` at monorepo root, confirm web app starts (`pnpm --filter @vitaltrack/web dev`) | Dev | 1 |

**Acceptance:** `curl http://localhost:8000/api/v1/health` returns 200, web app loads at localhost:3000.

---

### 🏠 Dashboard — Wire to Live API (Day 2–4)
| # | Task | Points |
|---|---|---|
| 1.6 | Replace static metric card data in `(dashboard)/page.tsx` with `useLatestVitals()` hook results | 3 |
| 1.7 | Add loading skeletons to metric cards (pulse animation, same card dimensions) | 2 |
| 1.8 | Wire greeting to real user session (`supabase.auth.getUser()` → first name) | 1 |
| 1.9 | Wire "Medications Due Today" widget to real `medicationsApi.list()` filtered by today's schedule | 2 |
| 1.10 | Wire alert banners to `useAlerts()` hook (already exists in analytics hooks) | 1 |

**Acceptance:** Refresh dashboard — cards show `—` when no data, real numbers when data exists.

---

### 📅 Appointments — Full Feature (Day 4–8)
| # | Task | Points |
|---|---|---|
| 1.11 | Create `backend/app/models/appointment.py` — fields: id, user_id, title, provider_name, specialty, location, appointment_date, duration_minutes, status (scheduled/completed/cancelled), notes, reminder_sent | 3 |
| 1.12 | Add to `supabase/migrations/000008_appointments.sql` — table + RLS policy + index on `appointment_date` | 2 |
| 1.13 | Create `backend/app/api/v1/routers/appointments.py` — CRUD (GET list, POST, GET by id, PATCH, DELETE) + `GET /upcoming` endpoint | 3 |
| 1.14 | Register appointments router in `backend/app/main.py` | 1 |
| 1.15 | Add `appointmentsApi` to `apps/web/src/lib/api/client.ts` | 1 |
| 1.16 | Add `useAppointments`, `useCreateAppointment`, `useUpdateAppointment`, `useDeleteAppointment` hooks to new `lib/hooks/useAppointments.ts` | 2 |
| 1.17 | Build `(dashboard)/appointments/page.tsx` — calendar-style list view, upcoming/past tabs, appointment cards with provider/specialty/date/time | 5 |
| 1.18 | Build `AddAppointmentModal` component — title, provider, specialty, date/time picker, location, notes fields | 3 |

**Acceptance:** Can create an appointment, see it in the list, edit it, delete it.

---

### 🔐 Auth Flow Polish (Day 8–10)
| # | Task | Points |
|---|---|---|
| 1.19 | Build `/profile` page — display name, email, avatar upload (Supabase Storage), date joined | 3 |
| 1.20 | Add email confirmation handling in `(auth)` layout — redirect if not confirmed | 2 |
| 1.21 | Build forgot-password flow (`/auth/reset-password`) | 2 |
| 1.22 | Wire TopBar avatar to real session (initials + avatar_url from `user_profiles`) | 1 |

**Sprint 1 Total Points:** ~42  
**Sprint 1 Deliverable:** A fully live web app — real data, real auth, appointments working.

---

## Sprint 2 — Forms, Interactions & Polish
**Duration:** 2 weeks  
**Goal:** Every piece of data can be added, edited, and deleted via the UI.

### 📝 CRUD Modals — All Domains (Day 1–6)
| # | Task | Points |
|---|---|---|
| 2.1 | `LogVitalModal` — already has `VitalsLogForm`, add modal wrapper with vital type selector | 2 |
| 2.2 | `AddMedicationModal` — name, dose, frequency, start date, notes (form already started) | 3 |
| 2.3 | `AddConditionModal` — name, ICD-10 code, severity, status, onset date | 3 |
| 2.4 | `AddAllergyModal` — allergen, reaction, severity (mild/moderate/severe) | 2 |
| 2.5 | `AddEncounterModal` — date, visit type, provider, chief complaint, diagnosis, treatment plan | 3 |
| 2.6 | `AddImmunizationModal` — vaccine name, date, lot number, manufacturer | 2 |
| 2.7 | `AddLabResultModal` — test name, LOINC code, ordered date + component rows (value, unit, ref range) | 4 |
| 2.8 | `LogSymptomModal` — symptom name, category, severity scale 1–10, triggers, duration | 3 |
| 2.9 | Wire all "Add" buttons on the Records page tabs to open their respective modals | 2 |
| 2.10 | Add inline edit on all records tab rows (click row → pre-filled modal) | 3 |

---

### ⚙️ Settings & Help Pages (Day 6–9)
| # | Task | Points |
|---|---|---|
| 2.11 | Build `/settings` page — notification preferences, units (metric/imperial), timezone, data export button | 4 |
| 2.12 | Build `/help` page — FAQ accordion, contact form, keyboard shortcuts reference | 2 |
| 2.13 | Add data export endpoint `GET /api/v1/export` (returns JSON of all user's data — HIPAA right-of-access) | 3 |

---

### 📊 Vitals — Chart Improvements (Day 9–12)
| # | Task | Points |
|---|---|---|
| 2.14 | Add blood pressure dual-line chart (systolic + diastolic on same axes) | 3 |
| 2.15 | Add reference range bands to TrendChart (e.g., grey band between 60–100 for heart rate) | 2 |
| 2.16 | Add "Log Reading" button inline on vitals page — opens `LogVitalModal` pre-filled with selected type | 1 |
| 2.17 | Add statistics summary row below chart (min, max, avg, readings count) for selected period | 2 |

---

### 🗂️ Reports Page (Day 12–14)
| # | Task | Points |
|---|---|---|
| 2.18 | Build `GET /api/v1/reports/summary` endpoint — aggregates vitals, meds adherence, appointments, labs for a date range | 4 |
| 2.19 | Build Reports page — date range picker, summary stats cards, "Download PDF" button | 3 |
| 2.20 | PDF generation via `@react-pdf/renderer` — one-page health summary with charts rendered as SVG | 5 |

**Sprint 2 Total Points:** ~56  
**Sprint 2 Deliverable:** Every domain is fully interactive; no placeholder pages remain.

---

## Sprint 3 — Mobile App
**Duration:** 2 weeks  
**Goal:** Mobile app runs on device, all screens show live data.

### 📱 Setup & Auth (Day 1–3)
| # | Task | Points |
|---|---|---|
| 3.1 | Run `pnpm install` at monorepo root — install Expo dependencies | 1 |
| 3.2 | Fill `apps/mobile/.env.local` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_BASE_URL` | 1 |
| 3.3 | Run `npx expo start` — confirm Metro bundler starts, app opens in Expo Go | 2 |
| 3.4 | Wire `app/(auth)/login.tsx` to real Supabase `signInWithPassword` + Google OAuth (`expo-auth-session`) | 4 |
| 3.5 | Test auth redirect: unauthenticated → login, authenticated → home tab | 2 |

---

### 🏠 Home & Vitals Screens (Day 3–7)
| # | Task | Points |
|---|---|---|
| 3.6 | Wire Home screen greeting to real user session first name | 1 |
| 3.7 | Wire 6 metric tiles to `useLatestVitals()` hook — show `—` when no data | 3 |
| 3.8 | Wire glucose alert banner to `useAlerts()` hook — only show if active high/low alerts exist | 2 |
| 3.9 | Wire hero heart-rate card to latest heart_rate reading | 1 |
| 3.10 | Wire "Up next today" to real medications (due today) + appointments (upcoming 7 days) | 3 |
| 3.11 | Wire Vital Detail screen chart to `useVitalHistory(type, range)` hook — update on range picker tap | 4 |
| 3.12 | Wire stats row (min/max/avg/target) to real calculated values from history data | 2 |
| 3.13 | Wire recent readings list to real `useVitalsList({ vital_type, page_size: 5 })` | 1 |

---

### 💊 Medications & Quick Log (Day 7–10)
| # | Task | Points |
|---|---|---|
| 3.14 | Wire Medications screen to `useMedications()` hook | 2 |
| 3.15 | Wire "Mark taken" button to `useTakeMedication()` mutation — optimistic update | 2 |
| 3.16 | Wire "Skip" action (long-press or swipe) to `useSkipMedication()` mutation | 2 |
| 3.17 | Wire Quick Log Sheet submit to `useQuickLog()` mutation with number input step | 3 |
| 3.18 | Add haptic feedback on Mark/Skip/Log actions (`expo-haptics`) | 1 |

---

### 👤 Profile & Polish (Day 10–14)
| # | Task | Points |
|---|---|---|
| 3.19 | Wire Profile screen to real `user_profiles` data (name, email, join date) | 2 |
| 3.20 | Wire Conditions and Allergies rows on Profile to `useConditions()` / `useAllergies()` hooks | 2 |
| 3.21 | Wire Sign out to `supabase.auth.signOut()` + navigation to login | 1 |
| 3.22 | Add pull-to-refresh on Home and Vitals screens | 1 |
| 3.23 | Create EAS build profile (`eas.json`) — development + preview builds | 2 |
| 3.24 | Run `eas build --profile development --platform ios` — get TestFlight build | 3 |

**Sprint 3 Total Points:** ~47  
**Sprint 3 Deliverable:** Mobile app runs on real device with live data.

---

## Sprint 4 — Quality, Tests & Launch
**Duration:** 2 weeks  
**Goal:** Production-ready: tested, deployed, CI running.

### 🧪 Testing (Day 1–6)
| # | Task | Points |
|---|---|---|
| 4.1 | Set up Vitest + React Testing Library for web app | 2 |
| 4.2 | Unit tests for `lib/utils.ts` — `formatMetricValue`, `getMetricStatus`, `greetingByHour` | 2 |
| 4.3 | Component tests — MetricCard, StatusChip, AlertBanner render tests | 3 |
| 4.4 | API integration tests for backend — pytest fixtures for vitals CRUD, medications CRUD | 4 |
| 4.5 | RLS policy tests — verify user A cannot read user B's vitals | 3 |
| 4.6 | Playwright e2e — login → log vital → see it on dashboard | 4 |
| 4.7 | Mobile: Jest + React Native Testing Library — MetricCard, QuickLogSheet unit tests | 3 |

---

### 🚀 CI/CD (Day 5–8)
| # | Task | Points |
|---|---|---|
| 4.8 | GitHub Actions: `ci.yml` — on PR: `pnpm lint`, `pnpm typecheck`, `pnpm test` for web + backend | 3 |
| 4.9 | GitHub Actions: `deploy-backend.yml` — on merge to main: deploy FastAPI to Railway / Render | 3 |
| 4.10 | GitHub Actions: `deploy-web.yml` — on merge to main: `pnpm build` + deploy to Vercel | 2 |
| 4.11 | Add `NEXT_PUBLIC_API_URL` production env var in Vercel pointing to deployed backend | 1 |
| 4.12 | GitHub Actions: `eas-preview.yml` — on PR to main: trigger EAS preview build for mobile | 2 |

---

### 🔔 Notifications & HIPAA Hardening (Day 8–11)
| # | Task | Points |
|---|---|---|
| 4.13 | Web: browser Push Notification for critical vital alerts (service worker + VAPID) | 4 |
| 4.14 | Mobile: `expo-notifications` push token registration, store in `user_profiles.push_token` | 3 |
| 4.15 | Backend: notification trigger in analytics router — send push when alert severity = critical | 3 |
| 4.16 | Audit log review — verify every PHI write in clinical/vitals/meds routers calls `audit_log()` | 2 |
| 4.17 | Add rate limiting back with Redis (`RATE_LIMIT_ENABLED=true` in prod, Redis on Railway) | 2 |

---

### 🎨 Figma & Design Sync (Day 11–14)
| # | Task | Points |
|---|---|---|
| 4.18 | Upgrade Figma plan OR wait for MCP quota reset → run `FIGMA_CONTINUATION.md` handoff | 1 |
| 4.19 | Deploy all 6 mobile screens to Figma via MCP (`use_figma` Plugin API) | 5 |
| 4.20 | Push final code state to GitHub including all sprint 1–3 changes | 1 |
| 4.21 | Update repo README with setup instructions, env vars list, architecture diagram | 2 |

**Sprint 4 Total Points:** ~55  
**Sprint 4 Deliverable:** Deployed app, CI green, Figma design live.

---

## Summary

| Sprint | Focus | Points | Duration |
|---|---|---|---|
| **Sprint 1** | Live foundation — real data, appointments, auth | 42 | 2 weeks |
| **Sprint 2** | Forms, CRUD modals, settings, reports | 56 | 2 weeks |
| **Sprint 3** | Mobile app wired to live API | 47 | 2 weeks |
| **Sprint 4** | Tests, CI/CD, notifications, deploy, Figma | 55 | 2 weeks |
| **Total** | | **200** | **8 weeks** |

---

## What to Tackle First (Unblocks Everything)

1. **Fill in `backend/.env`** — without real Supabase credentials nothing works
2. **`supabase db push`** — apply 7 pending migrations
3. **`pnpm install` + start both servers** — confirm end-to-end connection

These three steps take < 30 minutes and unlock every other ticket in Sprint 1.

---

## Files Reference

| File | Purpose |
|---|---|
| `backend/.env` | Fill DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET_KEY |
| `apps/web/.env.local` | Set NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY |
| `apps/mobile/.env.local` | Copy from `apps/mobile/.env.local.example`, fill same Supabase values |
| `supabase/migrations/` | 7 migration files — run `supabase db push` |
| `design-bundle/FIGMA_CONTINUATION.md` | Resume Figma deployment when quota resets |
| `design-bundle/VitalTrack-Mobile-Handoff.html` | All 6 mobile screens — open in browser |
| `apps/web/src/app/(dashboard)/appointments/page.tsx` | Replace placeholder — Sprint 1 ticket 1.17 |
| `apps/web/src/app/(dashboard)/reports/page.tsx` | Replace placeholder — Sprint 2 ticket 2.19 |
