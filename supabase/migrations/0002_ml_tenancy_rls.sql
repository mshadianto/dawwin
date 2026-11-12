-- DAWWIN 0002 — RLS per tenant untuk tabel ML.
-- Jalankan hanya jika scripts/ml-schema.sql pernah diterapkan, setelah 0001.
-- Bila salah satu tabel ml_* tidak ada, migrasi berhenti tanpa mengubah apa pun.

BEGIN;

DO $$
DECLARE
  t TEXT;
  p RECORD;
  legacy UUID := (SELECT id FROM tenants WHERE plan = 'legacy' ORDER BY created_at LIMIT 1);
BEGIN
  IF legacy IS NULL THEN
    RAISE EXCEPTION 'Jalankan 0001_tenancy_rls.sql lebih dulu.';
  END IF;
  FOREACH t IN ARRAY ARRAY['ml_workspaces', 'ml_experiments', 'ml_run_log']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE EXCEPTION 'Tabel % tidak ada. Jalankan scripts/ml-schema.sql dulu, atau lewati migrasi ini.', t;
    END IF;

    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE %I SET tenant_id = %L', t, legacy);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT current_tenant_id()', t);
    EXECUTE format('CREATE INDEX %I ON %I (tenant_id)', t || '_tenant_idx', t);

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY tenant_select ON %I FOR SELECT TO authenticated USING (tenant_id = (SELECT current_tenant_id()))', t);
    EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT TO authenticated WITH CHECK (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);
    EXECUTE format('CREATE POLICY tenant_update ON %I FOR UPDATE TO authenticated USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write())) WITH CHECK (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);
    EXECUTE format('CREATE POLICY tenant_delete ON %I FOR DELETE TO authenticated USING (tenant_id = (SELECT current_tenant_id()) AND (SELECT current_tenant_can_write()))', t);

    EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated', t);
  END LOOP;
END $$;

ALTER TABLE ml_workspaces ADD CONSTRAINT ml_workspaces_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE ml_experiments ADD CONSTRAINT ml_experiments_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE ml_experiments ADD CONSTRAINT ml_experiments_workspace_tenant_fk
  FOREIGN KEY (workspace_id, tenant_id) REFERENCES ml_workspaces (id, tenant_id) ON DELETE CASCADE;
ALTER TABLE ml_run_log ADD CONSTRAINT ml_run_log_experiment_tenant_fk
  FOREIGN KEY (experiment_id, tenant_id) REFERENCES ml_experiments (id, tenant_id) ON DELETE CASCADE;

COMMIT;
