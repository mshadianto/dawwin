# Spec 001 — Login, isolasi tenant, dan pengamanan proxy AI

Status: diimplementasi di branch `feat/auth-tenant-rls`, **belum diterapkan ke database live**.
Menutup P0-1, P0-2, dan fondasi P0-3 dari `docs/agents/monetization-readiness.md`.

## Tujuan

1. Data satu klien tidak bisa dibaca atau diubah klien lain, maupun pihak tanpa login.
2. Proxy AI hanya melayani user yang login, dengan kuota per tenant.
3. Demo publik di GitHub Pages tetap jalan tanpa login dan tanpa menyentuh database.

## Bukan cakupan

- Pembayaran dan perpanjangan otomatis (lewat Wasith, spec terpisah).
- Pendaftaran mandiri. Tenant dibuat pemilik produk setelah klien deal.
- Autentikasi backend FastAPI (`backend/`), P1-4.
- Gating fitur per paket di UI. Kolom `plan` sudah ada, belum dipakai.

## Asumsi (diambil tanpa konfirmasi, mohon dikoreksi)

| # | Asumsi | Alasan |
|---|---|---|
| A1 | Satu user hanya menjadi anggota satu tenant | Cukup untuk klien pertama; menyederhanakan policy |
| A2 | Login email + password, akun dibuat lewat undangan Supabase | Penjualan lewat WhatsApp/email, bukan self-service |
| A3 | Baris lama di database adalah data mockup | Dipindah ke tenant "Legacy (pra-migrasi)", tidak dihapus |
| A4 | Kuota AI bawaan 200 panggilan/bulan per tenant, 10/menit per user | Angka awal, bisa diubah per tenant di tabel `tenants` |
| A5 | Tenant kedaluwarsa tetap bisa membaca dan mengubah datanya; hanya AI yang berhenti | Klien tidak boleh terkunci dari kertas kerja auditnya |
| A6 | Tanpa login = mode demo: data contoh statis + localStorage | Menjaga demo publik |
| A7 | AI bawaan tidak tersedia di mode demo | Tanpa identitas tidak ada dasar kuota; demo masih bisa pakai API key sendiri |

## Model data

```
tenants(id, name, plan, active_until, ai_monthly_quota)
tenant_members(tenant_id, user_id → auth.users, role)   -- role: owner|admin|auditor|viewer
ai_usage(tenant_id, user_id, model, created_at)
```

Semua tabel data (`audit_documents`, `lha_reports`, `lha_findings`,
`lha_fraud_indicators`, `lha_risk_profiles`, dan tiga tabel `ml_*`) mendapat
kolom `tenant_id NOT NULL`.

- Unik `audit_documents.slug` → `(tenant_id, slug)`.
- Unik `lha_reports.source_file` → `(tenant_id, source_file)`.
- Tabel anak memakai foreign key gabungan `(report_id, tenant_id)` sehingga
  temuan tidak bisa ditempelkan ke laporan tenant lain.

## Aturan akses (RLS)

| Peran | Baca | Tulis |
|---|---|---|
| anon (tanpa login) | tidak | tidak |
| viewer | tenant sendiri | tidak |
| auditor, admin, owner | tenant sendiri | tenant sendiri |

- `tenants`, `tenant_members`, `ai_usage`: hanya baca, hanya tenant sendiri.
  Perubahan hanya lewat service role / SQL editor.
- Fungsi `current_tenant_id()` dan `current_tenant_role()` (`SECURITY DEFINER`,
  `search_path` dikunci) menjadi satu-satunya sumber identitas tenant di policy.

## Proxy AI (`supabase/functions/ai-proxy`)

Urutan pemeriksaan, berhenti di kegagalan pertama:

1. Origin harus ada di `ALLOWED_ORIGINS` (env, dipisah koma). Tidak ada lagi `*`.
2. Header `Authorization` harus JWT user yang valid → 401.
3. Body: `prompt` string 1–20.000 karakter; `model` harus ada di allowlist
   (default `llama-3.3-70b-versatile`); `max_tokens` dipotong ke maksimum 2.000 → 422.
4. `consume_ai_quota(model)` di database: tenant ada, aktif, kuota bulanan dan
   batas per menit belum habis → 403 / 429. Pencatatan dan pengecekan dalam satu
   transaksi dengan advisory lock per tenant.
5. Panggil Groq. Galat upstream dicatat di log server; klien menerima pesan generik.

## Frontend

- `AuthProvider` menyimpan sesi dan tenant. Tombol **Masuk** / **Keluar** di sidebar.
- Mode demo: tidak ada panggilan ke tabel Supabase sama sekali.
- Mode tenant: `usePersistedState` dan `useLHAData` membaca/menulis tenant aktif.
  Kunci localStorage dipisah per tenant.
- Dihapus: penghapusan otomatis seluruh baris Supabase ketika data mengandung
  kata "BPKH"/"Keuangan Haji". Di mode tenant, data klien tidak pernah dibuang
  karena isi atau versi skema.

## Seam yang diuji

| Seam | Menangkap | Tidak menangkap |
|---|---|---|
| Migrasi SQL di Postgres (PGlite) lewat peran `anon`/`authenticated` | Bocor antar-tenant, akses anon, viewer menulis, FK lintas tenant, kuota | Perbedaan konfigurasi Supabase live |
| `createAiProxyHandler(deps)` lewat `Request`/`Response` | Urutan auth → validasi → kuota, CORS, batas model/token, galat generik | Runtime Deno dan Groq sungguhan |
| `resolvePersisted()` | Data tenant tidak dibuang; data demo lama dibersihkan | Perilaku React/efek |

Seam ini belum dikonfirmasi pemilik produk (dikerjakan tanpa sesi tanya-jawab).

## Risiko yang diterima

- Token sesi Supabase disimpan di localStorage (bawaan supabase-js untuk SPA).
  Mitigasi yang masuk akal berikutnya: CSP ketat di hosting.
- Anon key tetap ada di source. Setelah RLS ini, anon key tidak memberi akses data.

## Rollout (urutan wajib)

1. Backup database (Dashboard → Database → Backups, atau `pg_dump`).
2. Deploy frontend branch ini lebih dulu. Aman: tanpa login ia tidak menyentuh database.
3. Jalankan `supabase/migrations/0001_tenancy_rls.sql`, lalu `0002_ml_tenancy_rls.sql`
   bila tabel `ml_*` ada.
4. Supabase Auth: matikan "Allow new users to sign up"; undang user pertama.
5. `select admin_create_tenant('Nama Klien', 'email@klien', 'trial', now() + interval '30 days');`
6. Set secret fungsi: `ALLOWED_ORIGINS=https://mshadianto.github.io`, lalu
   `npx supabase functions deploy ai-proxy`.
7. Uji: login, simpan data, buka dari browser lain tanpa login → data tidak terlihat.

Rollback: restore backup langkah 1. Frontend baru tetap aman dipakai di atas skema lama
(mode demo), tetapi login akan gagal memuat tenant.
