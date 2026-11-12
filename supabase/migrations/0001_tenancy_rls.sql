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

CREATE FUNCTION can_write_tenant(p_tenant UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid() AND tenant_id = p_tenant
      AND role IN ('owner', 'admin', 'auditor')
  )
$$;

-- ── 3. Data lama dipindah ke tenant penampung, tidak dihapus ──────────────
INSERT INTO tenants (name, plan, ai_monthly_quota) VALUES ('Legacy (pra-migrasi)', 'legacy', 0);

-- ── 4. tenant_id + RLS di tabel data ──────────────────────────────────────
DROP POLICY IF EXISTS "anon_all_audit_documents" ON audit_documents;
DROP POLICY IF EXISTS "anon_all_lha_reports" ON lha_reports;
DROP POLICY IF EXISTS "anon_all_lha_findings" ON lha_findings;
DROP POLICY IF EXISTS "anon_all_lha_fraud_indicators" ON lha_fraud_indicators;
DROP POLICY IF EXISTS "anon_all_lha_risk_profiles" ON lha_risk_profiles;

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
    EXECUTE format('CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = current_tenant_id())', t);
    EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO authenticated WITH CHECK (can_write_tenant(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO authenticated USING (can_write_tenant(tenant_id)) WITH CHECK (can_write_tenant(tenant_id))', t);
    EXECUTE format('CREATE POLICY tenant_delete ON %I FOR DELETE TO authenticated USING (can_write_tenant(tenant_id))', t);

    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

-- Keunikan sekarang per tenant.
ALTER TABLE audit_documents DROP CONSTRAINT IF EXISTS audit_documents_slug_key;
ALTER TABLE audit_documents ADD CONSTRAINT audit_documents_tenant_slug_key UNIQUE (tenant_id, slug);
DROP INDEX IF EXISTS idx_lha_reports_source;
CREATE UNIQUE INDEX idx_lha_reports_tenant_source ON lha_reports (tenant_id, source_file);

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
CREATE FUNCTION consume_ai_quota(p_model TEXT) RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_tenant tenants%ROWTYPE;
  v_month  INTEGER;
  v_minute INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;

  SELECT t.* INTO v_tenant FROM tenants t
    JOIN tenant_members m ON m.tenant_id = t.id
   WHERE m.user_id = v_user LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_tenant');
  END IF;

  IF v_tenant.active_until IS NOT NULL AND v_tenant.active_until < now() THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'subscription_inactive');
  END IF;

  -- Serialkan per tenant supaya dua permintaan bersamaan tidak sama-sama lolos.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant.id::text, 0));

  SELECT count(*) INTO v_minute FROM ai_usage
   WHERE user_id = v_user AND created_at > now() - interval '1 minute';
  IF v_minute >= 10 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limited');
  END IF;

  SELECT count(*) INTO v_month FROM ai_usage
   WHERE tenant_id = v_tenant.id AND created_at >= date_trunc('month', now());
  IF v_month >= v_tenant.ai_monthly_quota THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded');
  END IF;

  INSERT INTO ai_usage (tenant_id, user_id, model) VALUES (v_tenant.id, v_user, left(p_model, 100));
  RETURN jsonb_build_object('allowed', true, 'remaining', v_tenant.ai_monthly_quota - v_month - 1);
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
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(trim(p_owner_email));
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User % belum ada. Undang dulu lewat Authentication > Users.', p_owner_email;
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
REVOKE EXECUTE ON FUNCTION current_tenant_id(), current_tenant_role(), can_write_tenant(UUID),
  consume_ai_quota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_tenant_id(), current_tenant_role(), can_write_tenant(UUID),
  consume_ai_quota(TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION admin_create_tenant(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_tenant(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMIT;
