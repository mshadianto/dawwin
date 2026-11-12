# DAWWIN — Kesiapan Monetisasi (backlog spec)

Hasil telaah kode per commit `cb52fdc` (30 Apr 2026), memakai checklist dari
`.claude/skills/security-and-hardening` dan `.claude/skills/shipping-and-launch`.
Tujuan: daftar hal yang harus beres sebelum DAWWIN disewakan bulanan ke klien.

Setiap butir di bawah dikerjakan sebagai satu spec terpisah:
`/grill-me` → `/spec-driven-development` → review Goldfish (`/egm:egm-review`) → `/tdd`.

> **Status 12 Nov 2026**: P0-1 dan P0-2 sudah diimplementasi dan diuji di branch
> `feat/auth-tenant-rls` (spec `docs/specs/001-auth-tenant-rls-ai-proxy.md`), tetapi
> **belum diterapkan ke database dan Edge Function live**. P0-3 baru fondasinya
> (login, tenant, kolom paket, kuota AI); pembayaran dan gating paket belum.
> P1-5 sebagian: Vitest + gate CI sudah ada, test `src/utils/` belum.

## P0 — Blokir penjualan

### 1. Semua data audit terbuka untuk publik
- **Kondisi**: `scripts/supabase-schema.sql` baris 75–79 membuat policy
  `FOR ALL USING (true) WITH CHECK (true)` di kelima tabel. `scripts/ml-schema.sql`
  baris 86–92 memakai pola `anon_*_access` yang sama.
- **Kondisi**: anon key dan URL project tertulis langsung di `src/lib/supabase.js`
  dan `src/ai/api.js`, di repo publik.
- **Akibat**: siapa pun yang membuka repo bisa membaca, mengubah, dan menghapus
  seluruh temuan audit, indikator fraud, dan profil risiko. Untuk produk audit
  internal, ini membatalkan penjualan ke klien mana pun.
- **Arah perbaikan**: Supabase Auth, kolom `tenant_id` di setiap tabel, policy RLS
  berbasis `auth.uid()` / keanggotaan tenant. Anon key boleh tetap publik setelah
  RLS benar.
- **Perlu dicek manual**: apakah policy di database live sama dengan file SQL ini.

### 2. Proxy AI bisa dipakai siapa saja atas biaya pemilik
- **Kondisi**: `supabase/functions/ai-proxy/index.ts` menerima `prompt`, `model`,
  dan `max_tokens` dari klien tanpa verifikasi user, tanpa batas, tanpa rate limit,
  dengan CORS `*`.
- **Akibat**: tagihan Groq bisa dikuras pihak luar; tidak ada dasar untuk kuota
  per paket langganan.
- **Arah perbaikan**: verifikasi JWT user, kunci daftar model di server, batasi
  `max_tokens`, rate limit dan pencatatan pemakaian per tenant.

### 3. Tidak ada login, tenant, atau paket
- **Kondisi**: tidak ada pemanggilan auth di `src/`. Data manual disimpan ke
  `localStorage` dan satu tabel `audit_documents` bersama.
- **Akibat**: sewa bulanan dengan paket kustom belum punya tempat menempel.
- **Arah perbaikan**: model `tenant → user → role`, tabel `subscriptions`
  (paket, masa aktif, kuota AI), gating fitur per paket. Pembayaran lewat Wasith.

## P1 — Sebelum klien pertama

### Sisa dari review Spec 001 (belum dikerjakan)
- **Tenant baru mendapat data contoh sebagai dokumen pertamanya.** `DEFAULT_STATE`
  berisi mockup; perlu state kosong untuk tenant. Tombol RESET juga mengisi ulang dengan mockup.
- **Audit Universe, Audit Plan, dan pilihan LHA hanya tersimpan di browser.** Sudah
  dipisah per tenant, tetapi tidak sampai ke server dan tidak terbagi antar anggota.
- **Konflik edit membuang perubahan lokal yang belum tersimpan.** Server tidak tertimpa
  dan user diberi tahu, tetapi tidak ada penggabungan. Satu dokumen JSON per tenant
  adalah akar masalahnya; pecah per entitas (temuan, observasi) bila tim klien lebih dari satu orang.
- **Tab Data Source** memakai jalur Supabase kedua (`src/services/supabaseClient.js`,
  tabel `lhas`, `findings`, `fraud_indicators`, `activity_log`) tanpa isolasi tenant.
  Disembunyikan di mode tenant. Periksa apakah tabel itu ada di project live dengan policy terbuka.
- **Belum terverifikasi di Supabase sungguhan**: migrasi, Edge Function di Deno,
  verifikasi token, dan login hanya diuji di PGlite, Node, dan Supabase tiruan.
- **`usePersistedState` dan `AuthContext` belum punya test otomatis** di repo.
- **Gating UI per peran** baru sebatas "viewer tidak menyimpan"; form belum dinonaktifkan.

### 4. Backend ML tanpa autentikasi
- `backend/routers/chat.py` (`/upload-dataset`, `/query`, `/stream`) dan
  `backend/routers/autofe.py` (`/run`) tidak memakai dependency auth.
  Upload dataset oleh pihak anonim harus ditutup sebelum backend dipasang publik.

### 5. Tidak ada test dan tidak ada gate di CI
- `package.json` tidak punya script `test`; `.github/workflows/deploy.yml`
  langsung build dan deploy setiap push ke `main`.
- Minimal: Vitest untuk `src/utils/` (fraudClassifier, findingsSimilarity,
  executiveMetrics, lhaAdapter) dan langkah `npm test` sebelum deploy.

### 6. API key pihak ketiga disimpan di browser
- Tab AI Settings menyimpan API key user dan memanggil provider langsung dari
  browser (`callDirect` di `src/ai/api.js`). Untuk versi berbayar, arahkan semua
  panggilan lewat proxy server.

## P2 — Kerapian
- `dist/` ikut ter-commit padahal ada di `.gitignore` dan CI sudah build sendiri.
- Kredensial Supabase terduplikasi di dua file; satukan di `src/lib/supabase.js`.
