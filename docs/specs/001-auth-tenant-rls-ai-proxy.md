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

- Unik `audit_documents.slug` → `(tenant_id, slug)`; unik `lha_reports.source_file` →
  `(tenant_id, source_file)`. Keunikan global lama dicari lewat katalog, bukan lewat nama.
- Tabel anak memakai foreign key gabungan `(report_id, tenant_id)` sehingga
  temuan tidak bisa ditempelkan atau dipindahkan ke laporan tenant lain.
- `audit_documents.version` naik satu pada setiap UPDATE (trigger). Klien hanya
  boleh menulis bila versi di server masih sama dengan yang terakhir dibacanya.

## Aturan akses (RLS)

| Peran | Baca | Tulis |
|---|---|---|
| anon (tanpa login) | tidak | tidak |
| viewer | tenant sendiri | tidak |
| auditor, admin, owner | tenant sendiri | tenant sendiri |

- Semua policy lama di tabel data dibuang lewat `pg_policies`, apa pun namanya,
  sebelum policy baru dibuat. Policy permisif yang tertinggal akan membuka data antar-tenant.
- `authenticated` hanya mendapat SELECT, INSERT, UPDATE, DELETE (TRUNCATE melewati RLS).
- `tenants`, `tenant_members`, `ai_usage`: hanya baca, hanya tenant sendiri.
  Perubahan hanya lewat service role / SQL editor.
- Fungsi `current_tenant_id()`, `current_tenant_role()`, `current_tenant_can_write()`
  (`SECURITY DEFINER`, `search_path` dikunci) menjadi satu-satunya sumber identitas
  tenant di policy.
- `admin_create_tenant` hanya menerima email yang sudah terkonfirmasi.

## Proxy AI (`supabase/functions/ai-proxy`)

Urutan pemeriksaan, berhenti di kegagalan pertama:

1. Origin harus ada di `ALLOWED_ORIGINS` (env, dipisah koma). Tidak ada lagi `*`.
2. Header `Authorization` harus access token user yang valid (anon key ditolak) → 401.
3. Body: `prompt` string 1–20.000 karakter; `model` harus ada di allowlist
   (default `llama-3.3-70b-versatile`); `max_tokens` dipotong ke maksimum 2.000 → 422.
4. `consume_ai_quota(user, model)` di database: tenant ada, aktif, kuota bulanan dan
   batas per menit belum habis → 403 / 429. Cek dan catat dalam satu transaksi
   dengan advisory lock per tenant. Fungsi ini **hanya bisa dipanggil service role**
   dari dalam Edge Function, dengan user id hasil verifikasi langkah 2; klien tidak
   bisa memanggilnya langsung untuk menguras kuota.
5. Panggil Groq. Bila gagal, timeout, atau jawabannya kosong: pemakaian dikembalikan
   (`refund_ai_quota`), galat upstream dicatat di log server, klien menerima pesan generik.

## Frontend

- `AuthProvider` menyimpan sesi dan tenant. Tombol **Masuk** / **Keluar** di sidebar.
  Gagal memuat keanggotaan ditampilkan sebagai galat dengan tombol coba lagi, bukan
  sebagai mode demo.
- Mode demo: tidak ada panggilan ke tabel Supabase bawaan. (Tab Data Source masih
  bisa disambungkan user ke project Supabase miliknya sendiri; tab itu disembunyikan
  di mode tenant.)
- Mode tenant:
  - Dokumen tidak bisa diedit sebelum versi server termuat. Gagal muat = layar galat, tidak ada tulis.
  - Tulis hanya bila isi berubah sejak sinkron terakhir, dengan cek versi. Bila
    ditolak (ada versi lebih baru), dokumen dimuat ulang dan user diberi tahu.
  - `activeTab` dan `aiConfig` (memuat API key pribadi) tidak pernah dikirim ke server.
  - Viewer: tidak ada tulis, ada pemberitahuan.
  - Semua tab analitik membaca laporan tenant; tenant tanpa laporan melihat
    keadaan kosong, tidak pernah data contoh.
  - Kunci localStorage dipisah per tenant; cache ML dibuang saat sesi meninggalkan tenant.
  - Keluar: perubahan tertunda dikirim dulu. Salinan lokal dokumen dihapus hanya
    bila server sudah memegang versi terbaru.
- Dihapus: penghapusan otomatis seluruh baris Supabase ketika data mengandung
  kata "BPKH"/"Keuangan Haji".

## Seam yang diuji

| Seam | Menangkap | Tidak menangkap |
|---|---|---|
| Migrasi SQL di Postgres (PGlite) lewat peran `anon`/`authenticated`/`service_role`, di atas skema lama yang sengaja diberi policy dan constraint bernama lain | Bocor antar-tenant, akses anon, viewer menulis, FK lintas tenant, TRUNCATE, cek versi, kuota dan refund | Perbedaan konfigurasi Supabase live; perilaku advisory lock di bawah beban paralel |
| `createAiProxyHandler(deps)` lewat `Request`/`Response` | Urutan auth → validasi → kuota, CORS, batas model/token, refund, galat generik | Runtime Deno, verifikasi token sungguhan, Groq |
| `resolvePersisted()`, `toRemote()`, `mergeRemote()`, `sameDocument()` | Data tenant tidak dibuang; API key tidak terkirim; pindah tab bukan perubahan | Perilaku React/efek |
| `withLegacyReports()` | Tab analitik mendapat bentuk data yang sama dari data contoh dan dari database | Isi analitik per tab |

Seam ini belum dikonfirmasi pemilik produk (dikerjakan tanpa sesi tanya-jawab).

Di luar test suite, build produksi dijalankan di Chrome headless terhadap Supabase
tiruan: login, muat dokumen, edit (PATCH dengan cek versi), konflik, viewer,
keluar dengan perubahan tertunda, dan klik semua tab di mode demo serta mode tenant
tanpa laporan. Skrip itu tidak ikut di repo; `usePersistedState` dan `AuthContext`
belum punya test otomatis.

## Hasil review independen

Spec dan diff direview oleh sesi terpisah yang tidak ikut merancang. Yang diperbaiki
sebagai hasilnya: policy lama dengan nama lain tetap hidup; viewer bisa menguras kuota
lewat RPC; kuota terpakai saat model gagal; API key pribadi ikut tersinkron ke anggota
lain; tulis terakhir menimpa tanpa cek versi; tab analitik masih menampilkan data
contoh untuk tenant; TRUNCATE tersedia bagi user; nama constraint diasumsikan;
perubahan tertunda hilang saat keluar; email belum terkonfirmasi bisa jadi owner.

Yang belum diperbaiki ada di `docs/agents/monetization-readiness.md` bagian P1.

## Risiko yang diterima

- Token sesi Supabase disimpan di localStorage (bawaan supabase-js untuk SPA).
  Mitigasi yang masuk akal berikutnya: CSP ketat di hosting.
- Anon key tetap ada di source. Setelah RLS ini, anon key tidak memberi akses data.

## Rollout (urutan wajib)

1. Backup database (Dashboard → Database → Backups, atau `pg_dump`).
2. Supabase Auth: matikan "Allow new users to sign up" dan pastikan konfirmasi email aktif.
3. Periksa project live: `select tablename, policyname, cmd, qual from pg_policies where schemaname = 'public';`
   Catat tabel di luar delapan tabel spec ini (mis. `lhas`, `findings`, `fraud_indicators`,
   `activity_log` yang dipakai tab Data Source). Migrasi ini tidak menyentuhnya.
4. Deploy frontend branch ini. Aman lebih dulu: tanpa login ia tidak menyentuh database.
5. Jalankan `supabase/migrations/0001_tenancy_rls.sql`, lalu `0002_ml_tenancy_rls.sql`
   bila ketiga tabel `ml_*` ada. Masing-masing satu transaksi: gagal di tengah = tidak ada yang berubah.
   Tidak untuk dijalankan dua kali.
6. Langsung setelahnya, set secret `ALLOWED_ORIGINS` (mis.
   `https://mshadianto.github.io,http://localhost:5173`) dan `npx supabase functions deploy ai-proxy`.
   Sampai langkah ini selesai, proxy lama yang terbuka masih terpasang.
7. Jalankan query pemeriksaan di akhir file 0001: tiap tabel data harus punya tepat empat policy `tenant_*`.
8. Undang user pertama, tunggu undangan diterima, lalu
   `select admin_create_tenant('Nama Klien', 'email@klien', 'trial', now() + interval '30 days');`
9. Bila baris lama ternyata data kerja sungguhan (bukan mockup), pindahkan dari tenant penampung:
   `update audit_documents set tenant_id = '<tenant baru>' where tenant_id = (select id from tenants where plan = 'legacy');`
   (ulangi untuk tabel `lha_*`, induk dan anak dalam satu transaksi).
10. Uji: login, simpan data, buka dari browser lain tanpa login → data tidak terlihat.

Rollback: restore backup langkah 1. Frontend baru tetap aman dipakai di atas skema lama
(mode demo), tetapi login akan gagal memuat tenant.
