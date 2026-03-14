# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Vite dev server (localhost:5173)
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
```

Deployment is automated via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`. The app is served at `https://mshadianto.github.io/dawwin/`.

**Manual deploy**: `npm run build`, then `git add dist -f && git commit && git push`.

## Supabase

- **Database seeding**: `node scripts/seed-supabase.mjs` — populates 6 LHA reports from `public/data/lha-parsed.json`
- **Schema**: `scripts/supabase-schema.sql` — 5 tables (audit_documents, lha_reports, lha_findings, lha_fraud_indicators, lha_risk_profiles)
- **Edge Functions**: `supabase/functions/ai-proxy/index.ts` — Groq LLaMA 3.3 proxy (deploy with `npx supabase functions deploy ai-proxy`)
- **Client**: `src/lib/supabase.js` — credentials hardcoded with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env var overrides

## Architecture

**Stack**: React 19 + Vite 6 SPA, Supabase (PostgreSQL + Edge Functions), Groq AI

### Two data domains

1. **Manual audit data** — user-editable fields (audit info, COSO assessment, findings, observations, action plans). Managed via `usePersistedState` hook with dual persistence: localStorage (immediate) + Supabase `audit_documents` table (1.5s debounced).
2. **LHA analytics data** — read-only parsed audit reports. Fetched via `useLHAData` hook from Supabase tables, falls back to static `public/data/lha-parsed.json`.

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
