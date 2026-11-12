-- DAWWIN 0002 — RLS per tenant untuk tabel ML.
-- Jalankan hanya jika scripts/ml-schema.sql pernah diterapkan, setelah 0001.

BEGIN;

DROP POLICY IF EXISTS "anon_workspace_access" ON ml_workspaces;
DROP POLICY IF EXISTS "anon_experiment_access" ON ml_experiments;
DROP POLICY IF EXISTS "anon_run_log_access" ON ml_run_log;

DO $$
DECLARE
  t TEXT;
  legacy UUID := (SELECT id FROM tenants WHERE plan = 'legacy' ORDER BY created_at LIMIT 1);
BEGIN
  IF legacy IS NULL THEN
    RAISE EXCEPTION 'Jalankan 0001_tenancy_rls.sql lebih dulu.';
  END IF;
  FOREACH t IN ARRAY ARRAY['ml_workspaces', 'ml_experiments', 'ml_run_log']
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

ALTER TABLE ml_workspaces ADD CONSTRAINT ml_workspaces_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE ml_experiments ADD CONSTRAINT ml_experiments_id_tenant_key UNIQUE (id, tenant_id);
ALTER TABLE ml_experiments ADD CONSTRAINT ml_experiments_workspace_tenant_fk
  FOREIGN KEY (workspace_id, tenant_id) REFERENCES ml_workspaces (id, tenant_id) ON DELETE CASCADE;
ALTER TABLE ml_run_log ADD CONSTRAINT ml_run_log_experiment_tenant_fk
  FOREIGN KEY (experiment_id, tenant_id) REFERENCES ml_experiments (id, tenant_id) ON DELETE CASCADE;

COMMIT;
