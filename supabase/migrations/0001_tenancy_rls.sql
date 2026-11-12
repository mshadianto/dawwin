-- DAWWIN 0001 — tenant, keanggotaan, RLS per tenant, kuota AI.
-- Spec: docs/specs/001-auth-tenant-rls-ai-proxy.md
-- BACKUP DATABASE SEBELUM MENJALANKAN. Jalankan sekali, di SQL Editor Supabase.

BEGIN;

-- ── 1. Tenant dan keanggotaan ─────────────────────────────────────────────
CREATE TABLE tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  plan             TEXT NOT NULL DEFAULT 'trial',
  active_until     TIMESTAMPTZ,                       -- NULL = tanpa batas waktu
  ai_monthly_quota INTEGER NOT NULL DEFAULT 200 CHECK (ai_monthly_quota >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_members (
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'auditor'
             CHECK (role IN ('owner', 'admin', 'auditor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
-- v1: satu user hanya di satu tenant (asumsi A1 di spec).
CREATE UNIQUE INDEX tenant_members_one_tenant_per_user ON tenant_members (user_id);

CREATE TABLE ai_usage (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  model      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_tenant_time ON ai_usage (tenant_id, created_at);
CREATE INDEX ai_usage_user_time ON ai_usage (user_id, created_at);

-- ── 2. Identitas tenant untuk policy ──────────────────────────────────────
-- SECURITY DEFINER supaya policy tidak rekursif ke RLS tenant_members.
CREATE FUNCTION current_tenant_id() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT tenant_id FROM tenant_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE FUNCTION current_tenant_role() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM tenant_members WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE FUNCTION current_tenant_can_write() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'auditor')
  )
$$;

-- ── 3. Data lama dipindah ke tenant penampung, tidak dihapus ──────────────
INSERT INTO tenants (name, plan, ai_monthly_quota) VALUES ('Legacy (pra-migrasi)', 'legacy', 0);

-- ── 4. tenant_id + RLS di tabel data ──────────────────────────────────────
-- Semua policy lama dibuang lewat katalog, apa pun namanya. Policy permisif
-- yang tertinggal akan di-OR dengan policy baru dan membuka data antar-tenant.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN ('audit_documents', 'lha_reports', 'lha_findings',
                                'lha_fraud_indicators', 'lha_risk_profiles')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I', p.policyname, p.tablename);
  END LOOP;
END $$;

DO $$
DECLARE
  t TEXT;
  legacy UUID := (SELECT id FROM tenants WHERE plan = 'legacy' ORDER BY created_at LIMIT 1);
BEGIN
  FOREACH t IN ARRAY ARRAY['audit_documents', 'lha_reports', 'lha_findings',
                           'lha_fraud_indicators', 'lha_risk_profiles']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE %I SET tenant_id = %L', t, legacy);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT current_tenant_id()', t);
    EXECUTE format('CREATE INDEX %I ON %I (tenant_id)', t || '_tenant_idx', t);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- (SELECT ...) membuat fungsi dievaluasi sekali per query, bukan per baris.
    EXECUTE format('CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT current_tenant_id()))', t);
    EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);
    EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO authenticated USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write())) WITH CHECK (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);
    EXECUTE format('CREATE POLICY tenant_delete ON %I FOR DELETE TO authenticated USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);

    -- TRUNCATE tidak tunduk pada RLS: beri hanya empat hak yang dipakai aplikasi.
    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

-- Keunikan sekarang per tenant.
-- Keunikan global lama dibuang lewat katalog (nama constraint di database live
-- bisa berbeda dari file schema), lalu diganti keunikan per tenant.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT i.indexrelid::regclass AS index_name, c.conname, i.indrelid::regclass AS table_name
      FROM pg_index i
      LEFT JOIN pg_constraint c ON c.conindid = i.indexrelid AND c.contype = 'u'
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE i.indisunique AND NOT i.indisprimary AND i.indnatts = 1
       AND ((i.indrelid = 'public.audit_documents'::regclass AND a.attname = 'slug')
         OR (i.indrelid = 'public.lha_reports'::regclass AND a.attname = 'source_file'))
  LOOP
    IF r.conname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
    ELSE
      EXECUTE format('DROP INDEX %s', r.index_name);
    END IF;
  END LOOP;
END $$;
ALTER TABLE audit_documents ADD CONSTRAINT audit_documents_tenant_slug_key UNIQUE (tenant_id, slug);
CREATE UNIQUE INDEX idx_lha_reports_tenant_source ON lha_reports (tenant_id, source_file);

-- Nomor versi dokumen: dasar penolakan tulis dari salinan yang sudah basi
-- (dua auditor, atau satu user di dua perangkat).
ALTER TABLE audit_documents ADD COLUMN version BIGINT NOT NULL DEFAULT 1;
CREATE FUNCTION bump_audit_document_version() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_documents_version
  BEFORE UPDATE ON audit_documents
  FOR EACH ROW EXECUTE FUNCTION bump_audit_document_version();

-- Tabel anak harus berada di tenant yang sama dengan laporannya.
ALTER TABLE lha_reports ADD CONSTRAINT lha_reports_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE lha_findings ADD CONSTRAINT lha_findings_report_tenant_fk
  FOREIGN KEY (report_id, tenant_id) REFERENCES lha_reports (id, tenant_id) ON DELETE CASCADE;
ALTER TABLE lha_fraud_indicators ADD CONSTRAINT lha_fraud_indicators_report_tenant_fk
  FOREIGN KEY (report_id, tenant_id) REFERENCES lha_reports (id, tenant_id) ON DELETE CASCADE;
ALTER TABLE lha_risk_profiles ADD CONSTRAINT lha_risk_profiles_report_tenant_fk
  FOREIGN KEY (report_id, tenant_id) REFERENCES lha_reports (id, tenant_id) ON DELETE CASCADE;

-- ── 5. Tabel kontrol: hanya baca, hanya tenant sendiri ────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_self_select ON tenants FOR SELECT TO authenticated
  USING (id = current_tenant_id());
CREATE POLICY members_same_tenant_select ON tenant_members FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());
CREATE POLICY usage_same_tenant_select ON ai_usage FOR SELECT TO authenticated
  USING (tenant_id = current_tenant_id());

REVOKE ALL ON tenants, tenant_members, ai_usage FROM anon, authenticated;
GRANT SELECT ON tenants, tenant_members, ai_usage TO authenticated;

-- ── 6. Kuota AI: cek + catat dalam satu transaksi ─────────────────────────
-- Hanya service role (Edge Function ai-proxy) yang boleh memanggil. User id
-- dikirim oleh fungsi itu setelah token diverifikasi; klien tidak bisa
-- memanggilnya langsung untuk menguras kuota.
CREATE FUNCTION consume_ai_quota(p_user UUID, p_model TEXT) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant tenants%ROWTYPE;
  v_month  INTEGER;
  v_minute INTEGER;
  v_usage  BIGINT;
BEGIN
  IF p_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  SELECT t.* INTO v_tenant FROM tenants t
    JOIN tenant_members m ON m.tenant_id = t.id
   WHERE m.user_id = p_user LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_tenant');
  END IF;

  IF v_tenant.active_until IS NOT NULL AND v_tenant.active_until < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive');
  END IF;

  -- Serialkan per tenant supaya dua permintaan bersamaan tidak sama-sama lolos.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant.id::text, 0));

  SELECT count(*) INTO v_minute FROM ai_usage
   WHERE user_id = p_user AND created_at > now() - interval '1 minute';
  IF v_minute >= 10 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited');
  END IF;

  SELECT count(*) INTO v_month FROM ai_usage
   WHERE tenant_id = v_tenant.id AND created_at >= date_trunc('month', now());
  IF v_month >= v_tenant.ai_monthly_quota THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded');
  END IF;

  INSERT INTO ai_usage (tenant_id, user_id, model) VALUES (v_tenant.id, p_user, left(p_model, 100))
    RETURNING id INTO v_usage;
  RETURN jsonb_build_object('allowed', true, 'usage_id', v_usage,
                            'remaining', v_tenant.ai_monthly_quota - v_month - 1);
END $$;

-- Dipanggil ai-proxy ketika model gagal menjawab, supaya kegagalan tidak memakan kuota.
CREATE FUNCTION refund_ai_quota(p_user UUID, p_usage_id BIGINT) RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  DELETE FROM ai_usage
   WHERE id = p_usage_id AND user_id = p_user AND created_at > now() - interval '5 minutes';
  RETURN FOUND;
END $$;

-- ── 7. Provisioning tenant: hanya pemilik produk ──────────────────────────
CREATE FUNCTION admin_create_tenant(
  p_name TEXT, p_owner_email TEXT, p_plan TEXT DEFAULT 'trial', p_active_until TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user UUID;
  v_tenant UUID;
BEGIN
  -- Hanya email yang sudah terkonfirmasi: mencegah orang lain mendaftar lebih
  -- dulu dengan alamat klien lalu menjadi owner tenant.
  SELECT id INTO v_user FROM auth.users
   WHERE lower(email) = lower(trim(p_owner_email)) AND email_confirmed_at IS NOT NULL;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User % belum ada atau emailnya belum terkonfirmasi. Undang lewat Authentication > Users dan tunggu undangan diterima.', p_owner_email;
  END IF;
  IF EXISTS (SELECT 1 FROM tenant_members WHERE user_id = v_user) THEN
    RAISE EXCEPTION 'User % sudah menjadi anggota tenant lain.', p_owner_email;
  END IF;
  INSERT INTO tenants (name, plan, active_until) VALUES (p_name, p_plan, p_active_until)
    RETURNING id INTO v_tenant;
  INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (v_tenant, v_user, 'owner');
  RETURN v_tenant;
END $$;

-- ── 8. Hak eksekusi fungsi ────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION current_tenant_id(), current_tenant_role(), current_tenant_can_write()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_tenant_id(), current_tenant_role(), current_tenant_can_write()
  TO authenticated;

REVOKE EXECUTE ON FUNCTION consume_ai_quota(UUID, TEXT), refund_ai_quota(UUID, BIGINT),
  admin_create_tenant(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_ai_quota(UUID, TEXT), refund_ai_quota(UUID, BIGINT),
  admin_create_tenant(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- ── 9. Pemeriksaan pasca-migrasi ──────────────────────────────────────────
-- Setiap tabel data harus punya tepat empat policy tenant_*. Jalankan dan periksa:
--   SELECT tablename, policyname, cmd, roles, qual FROM pg_policies
--    WHERE schemaname = 'public' ORDER BY tablename, policyname;

COMMIT;
