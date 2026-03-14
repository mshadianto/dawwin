# DAWWIN — Audit Intelligence Platform

<div align="center">

**دوِّن** &nbsp;|&nbsp; Sistem Dokumentasi & Analitik Audit Internal

[![Deploy](https://github.com/mshadianto/dawwin/actions/workflows/deploy.yml/badge.svg)](https://github.com/mshadianto/dawwin/actions/workflows/deploy.yml)
[![Live Demo](https://img.shields.io/badge/demo-live-059669)](https://mshadianto.github.io/dawwin/)

</div>

---

DAWWIN adalah platform audit intelligence berbasis web yang dirancang untuk auditor internal. Mengintegrasikan framework **COSO 2013**, standar **IIA Global**, dan **ISO 31000:2018** dalam satu antarmuka profesional bergaya McKinsey/Big 4.

## Fitur Utama

### Dokumentasi Audit
- **Info Audit** — Metadata penugasan (judul, nomor, periode, unit kerja, tim)
- **Penilaian COSO** — Evaluasi 5 komponen pengendalian internal dengan radar chart
- **Temuan (C4R)** — Condition → Criteria → Cause → Effect → Recommendation
- **Observasi** — Catatan pengamatan minor
- **Tindak Lanjut** — Tracking action plan dengan status (Open/In Progress/Closed)

### LHA Analytics
- **Analytics** — Portfolio overview, root cause taxonomy, risk exposure, red flag analysis
- **Risk Management** — 5×5 heatmap, risk appetite vs actual, cross-tabulation matrix
- **Fraud Detection** — Pattern intelligence, forensic indicator registry, threat scoring
- **ISO 31000** — Full risk management process: context, identification, analysis, evaluation, treatment, monitoring & compliance scorecard

### AI-Powered Analysis
- Analisis otomatis C4R (Cause, Effect, Recommendation) menggunakan **Groq LLaMA 3.3 70B**
- Prompt engineering berbasis konteks audit dan framework COSO/IIA

### Data & Persistence
- Dual persistence: localStorage (offline) + **Supabase** (cloud sync)
- 6 sample LHA reports dengan findings, fraud indicators, dan risk profiles
- Export data audit ke JSON

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6 |
| Database | Supabase (PostgreSQL) |
| AI | Groq API (LLaMA 3.3 70B) via Supabase Edge Function |
| Hosting | GitHub Pages |
| Charts | Custom SVG (RadarChart, DonutChart, ScatterPlot, HeatCell) |

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

### Supabase Setup (Optional)

1. Buat project di [supabase.com](https://supabase.com)
2. Jalankan schema: `scripts/supabase-schema.sql`
3. Seed data: `node scripts/seed-supabase.mjs`
4. Set environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### AI Setup (Optional)

1. Deploy Edge Function:
   ```bash
   npx supabase functions deploy ai-proxy --project-ref your-ref
   ```
2. Set Groq API key sebagai Supabase secret:
   ```bash
   npx supabase secrets set GROQ_API_KEY=your-groq-key --project-ref your-ref
   ```

## Struktur Project

```
src/
├── App.jsx                 # Layout utama (sidebar + tab routing)
├── main.jsx                # Entry point
├── ai/                     # AI integration (Groq API, prompts, panel UI)
├── components/ui.jsx       # Design system & SVG chart components
├── constants/              # Tab definitions, ratings, default state
├── hooks/                  # usePersistedState, useLHAData
├── lib/supabase.js         # Supabase client
└── tabs/                   # 10 tab components (Dashboard, COSO, ISO31000, etc.)
scripts/
├── parse-lha.py            # Parse LHA PDF ke JSON
├── seed-supabase.mjs       # Populate Supabase dari JSON
└── supabase-schema.sql     # Database schema
public/data/
└── lha-parsed.json         # 6 sample audit reports
```

## Standards & Frameworks

- **COSO 2013** — Committee of Sponsoring Organizations Internal Control Framework
- **IIA Global Standards** — Institute of Internal Auditors
- **ISO 31000:2018** — Risk Management Guidelines
- **C4R** — Condition, Criteria, Cause, Effect, Recommendation

## License

MIT

---

<div align="center">
<sub>Built by <a href="https://github.com/mshadianto">MSHadianto</a> &nbsp;|&nbsp; AI-Powered Audit Intelligence</sub>
</div>
