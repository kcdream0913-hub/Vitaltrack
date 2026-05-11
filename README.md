# VitalTrack — Your health, clearly tracked.

A HIPAA-compliant personal health dashboard for tracking vitals, medications, appointments, sleep, and nutrition.

---

## 🏗️ Stack

| Layer      | Technology                                      |
|------------|--------------------------------------------------|
| Frontend   | Next.js 14 (App Router), TypeScript, Tailwind v3 |
| Backend    | FastAPI (Python 3.12), Pydantic v2, structlog    |
| Database   | Supabase (PostgreSQL 15, RLS, Realtime, Storage) |
| Auth       | Supabase Auth (JWT RS256, MFA TOTP, PKCE OAuth) |
| Cache      | Redis (Railway)                                  |
| Monorepo   | Turborepo + pnpm workspaces                      |
| Deploy     | Vercel (frontend) · Railway (backend) · Supabase |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ and pnpm 9+
- Python 3.12+
- Supabase CLI (`npm i -g supabase`)

### 1. Clone & install
```bash
git clone https://github.com/your-org/vitaltrack
cd vitaltrack
pnpm install
```

### 2. Environment variables
```bash
cp apps/web/.env.example apps/web/.env.local
```
Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.

### 3. Start Supabase locally
```bash
supabase start
supabase db push          # applies all 6 migration files
```

### 4. Start backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 5. Start frontend
```bash
pnpm dev   # from repo root (Turborepo runs all apps)
```

Open http://localhost:3000

---

## 📁 Project Structure

```
vitaltrack/
├── apps/
│   └── web/                    # Next.js 14 frontend
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── (dashboard)/  # Protected dashboard routes
│           │   │   ├── page.tsx          # Dashboard home
│           │   │   ├── vitals/           # Vitals log & trends
│           │   │   ├── medications/      # Medication tracker
│           │   │   └── analytics/        # AI insights
│           │   ├── login/      # Auth pages
│           │   └── auth/       # Supabase callback
│           ├── components/
│           │   ├── charts/     # TrendChart (Recharts)
│           │   ├── layout/     # Sidebar, TopBar
│           │   └── ui/         # MetricCard, StatusChip, etc.
│           └── lib/
│               ├── api/        # Typed API client
│               ├── hooks/      # React Query hooks
│               └── supabase/   # SSR-safe Supabase clients
├── backend/
│   └── app/
│       ├── main.py             # FastAPI app factory
│       ├── core/config.py      # Pydantic settings
│       └── api/v1/
│           ├── deps.py         # Auth dependencies
│           └── routers/
│               ├── vitals.py       # /api/v1/vitals
│               ├── medications.py  # /api/v1/medications
│               └── analytics.py    # /api/v1/analytics
└── supabase/
    ├── config.toml
    └── migrations/             # 6 sequential SQL migrations
        ├── 000001_foundation       (extensions, enums, audit log)
        ├── 000002_vitals_activity  (vitals, daily_activity, workouts)
        ├── 000003_nutrition_sleep  (food, water, sleep)
        ├── 000004_medications_appts (meds, schedules, providers, appts)
        ├── 000005_goals_notifs     (goals, notifications, reports)
        └── 000006_functions_views  (pg functions, views, RLS seed)
```

---

## 🔒 Security

- **Row Level Security** on all 24 PHI tables — users can only access their own data
- **JWT RS256** tokens issued by Supabase Auth
- **HTTPS-only** (HSTS headers, no mixed content)
- **CSP headers** configured in `next.config.ts`
- **Audit log** for all data mutations (append-only, 7-year retention)
- **Rate limiting** via slowapi + Redis (200 req/min default)
- **MFA (TOTP)** supported via Supabase Auth

---

## 🎨 Design System

Figma file: https://www.figma.com/design/f9b9mn8Q2dQAxidr9avUK0

| Token    | Value     | Usage                      |
|----------|-----------|----------------------------|
| Primary  | `#1E6FD9` | Actions, links, active nav |
| Secondary| `#16A085` | Success, normal status     |
| Accent   | `#E74C6F` | Alerts, high readings      |
| Warning  | `#F59E0B` | Warnings, low readings     |
| Mono     | JetBrains Mono | All numeric metric values |

---

## 📋 Roadmap

- [x] Wire FastAPI routers to Supabase (SQLAlchemy 2.0 + asyncpg)
- [ ] Real-time dashboard updates via Supabase Realtime
- [ ] Push notifications (Expo / Web Push)
- [ ] React Native mobile app (Expo SDK 51)
- [ ] PDF health reports
- [ ] Apple Health / Google Fit integrations
- [ ] Appointment calendar view
- [ ] Nutrition logging
