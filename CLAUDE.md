# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm test             # Vitest: RLS per tenant (PGlite), ai-proxy, aturan persist
```

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`. The app is served at `https://mshadianto.github.io/dawwin/`.

**Manual deploy**: `npm run build`, then `git add dist -f && git commit && git push`.

## Supabase

- **Schema dasar**: `scripts/supabase-schema.sql` (5 tabel) dan `scripts/ml-schema.sql`. RLS aktif tanpa policy.
- **Migrasi**: `supabase/migrations/0001_tenancy_rls.sql` (tenant, keanggotaan, RLS, kuota AI), `0002_ml_tenancy_rls.sql`. Perubahan skema berikutnya selalu sebagai file migrasi baru + test di `tests/rls.test.js`.
- **Tenant baru**: undang user di Authentication, lalu `select admin_create_tenant('Nama', 'email', 'trial', now() + interval '30 days');`
- **Seeding**: `node scripts/seed-supabase.mjs` dengan env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_TENANT_ID`.
- **Edge Function**: `supabase/functions/ai-proxy/` — `handler.ts` (logika, diuji di Vitest) + `index.ts` (wiring Deno). Secrets: `GROQ_API_KEY`, `ALLOWED_ORIGINS`. Fungsi kuota di database hanya untuk service role. Deploy: `npx supabase functions deploy ai-proxy`.
- **Client**: `src/lib/supabase.js` — satu-satunya tempat URL dan anon key.

## Auth dan tenant

- `src/auth/AuthContext.jsx` — status `demo | tenant | no_tenant | loading | error`. `useAuth()` memberi `tenant`, `role`, `canWrite`.
- **Mode demo** (tanpa login): tidak boleh ada panggilan ke tabel Supabase. Data contoh statis + localStorage.
- **Mode tenant**: `usePersistedState(..., { tenantId, canWrite })` (sinkron dengan cek versi, `src/hooks/documentSync.js`) dan `useLHAData()` (tenant dari sesi). Subtree di-remount lewat `key` saat tenant berubah.
- Field di `LOCAL_ONLY_FIELDS` (`activeTab`, `aiConfig`) tidak pernah dikirim ke server. Kunci localStorage baru wajib lewat `scopedKey()` dari `src/lib/tenantScope.js`.
- Tab analitik membaca `data.reports`; `withLegacyReports()` menyamakan bentuk data contoh dan data database.
- Data tenant tidak pernah dihapus otomatis oleh kode klien.

## Architecture

**Stack**: React 19 + Vite 6 SPA, Supabase (PostgreSQL + Edge Functions), Groq AI

### Two data domains

1. **Manual audit data** — user-editable fields (audit info, COSO assessment, findings, observations, action plans). Managed via `usePersistedState` hook: localStorage (immediate) + in tenant mode Supabase `audit_documents` (1.5s debounced, only after the initial remote load succeeded).
2. **LHA analytics data** — read-only parsed audit reports. `useLHAData()` reads the signed-in tenant's Supabase rows (empty tenants get an empty state, never sample data); demo mode uses static `public/data/lha-parsed.json`.

### Tab system

Tabs are defined in `src/constants/index.js` (TABS array) and routed in `App.jsx` via `TAB_COMPONENTS` map.

- **Manual tabs** (info, coso, findings, observations, actionplan): receive `data` and `setData` props
- **LHA analytics tabs** (analytics, risk, fraud, iso31000): standalone, use `useLHAData()` hook internally, render at 1200px max-width

### Key directories

- `src/tabs/` — one component per tab, self-contained with data processing logic
- `src/components/ui.jsx` — shared design system (Badge, Card, StatCard, RadarChart, DonutChart, ScatterPlot, HeatCell, ExhibitHeader, MaturityIndicator, etc.)
- `src/ai/` — AI integration: `api.js` (Groq via Supabase Edge Function), `prompts.js` (C4R prompt builder), `AIAnalysisPanel.jsx` (UI)
- `src/constants/` — tab definitions, rating scales, COSO/risk labels, default state with mock data

### Design conventions

- McKinsey exhibit-style numbering: A1-A10 (Analytics), R1-R4 (Risk), F1-F4 (Fraud), I1-I7 (ISO 31000)
- Typography: Source Serif 4 (headings), JetBrains Mono (data/labels), DM Sans (body)
- Color palette: #0F172A (navy), #C9A84C (gold accent), #059669/#D97706/#DC2626 (green/amber/red)
- SVG-based charts (no external charting library) — all in `ui.jsx`
- All UI text is in Indonesian (Bahasa Indonesia)

### Frameworks & standards

- **COSO 2013**: 5 components (control_environment, risk_assessment, control_activities, info_communication, monitoring) with 3-tier rating (memadai/perlu_perbaikan/lemah)
- **C4R format**: Condition → Criteria → Cause → Effect → Recommendation (used in findings)
- **ISO 31000:2018**: Risk scoring via Likelihood × Impact matrix (1-5 each), treatment classification (Avoid/Reduce/Transfer/Accept) via keyword analysis
- **Risk categories**: strategis, operasional, kepatuhan, reputasi, hukum

## Vite Config

- `base: "/dawwin/"` — required for GitHub Pages subpath
- Dev proxy: `/api/anthropic` → Anthropic API (legacy, unused in production)

## Alur kerja agent (wajib untuk perubahan non-trivial)

Skill ada di `.claude/skills/` (asal dan lisensi: `.claude/THIRD_PARTY_SKILLS.md`).

1. **Klarifikasi** — `/grill-me` sampai semua keputusan terjawab.
2. **Spec** — `/spec-driven-development`; simpan di `docs/specs/NNN-judul.md`.
3. **Review independen** — `/egm:egm-review` atas spec (plugin EGM). Reviewer harus sesi baru yang tidak ikut menyusun spec. Tanpa plugin: buka sesi baru, beri hanya file spec, minta dicari kelemahannya.
4. **Implementasi** — `/tdd`, satu irisan vertikal per commit. Bug: `/diagnosing-bugs`.
5. **Review kode** — `/code-review-and-quality`; apa pun yang menyentuh auth, RLS, Edge Function, atau `backend/` juga lewat `/security-and-hardening`.
6. **Rilis** — `/shipping-and-launch` sebelum merge ke `main` (push ke `main` langsung deploy).

Aturan tetap:
- Jangan menambah policy RLS `USING (true)` atau kredensial baru di source.
- Backlog kesiapan monetisasi: `docs/agents/monetization-readiness.md`. Kerjakan P0 berurutan.
