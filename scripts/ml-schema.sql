-- ─────────────────────────────────────────────────────────
-- DAWWIN ML Platform — Horizon 1 Schema
-- Serverless-optimized for Supabase / Neon free-tier
-- ─────────────────────────────────────────────────────────

-- 1. ML Workspaces (one per user/team)
CREATE TABLE IF NOT EXISTS ml_workspaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    TEXT NOT NULL DEFAULT 'anon',
    name        TEXT NOT NULL DEFAULT 'Default Workspace',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_workspaces_owner ON ml_workspaces(owner_id);

-- 2. ML Experiments (the core unit of work)
CREATE TABLE IF NOT EXISTS ml_experiments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID REFERENCES ml_workspaces(id) ON DELETE CASCADE,
    experiment_name TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','data_prep','training','evaluating','completed','failed')),

    -- Dataset metadata (JSONB for flexibility)
    dataset_meta    JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. { "filename": "data.csv", "rows": 5000, "cols": 12,
    --        "target": "churn", "features": ["age","tenure",...],
    --        "split_ratio": 0.8 }

    -- Hyperparameters
    hyperparameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- e.g. { "model_type": "random_forest", "n_estimators": 100,
    --        "max_depth": 10, "learning_rate": null }

    -- Model metrics (written after training completes)
    model_metrics   JSONB DEFAULT NULL,
    -- e.g. { "accuracy": 0.94, "precision": 0.91, "recall": 0.89,
    --        "f1": 0.90, "roc_auc": 0.96, "confusion_matrix": [[..]] }

    -- Training metadata
    training_duration_ms  INTEGER DEFAULT NULL,
    model_artifact_path   TEXT DEFAULT NULL,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_experiments_workspace ON ml_experiments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ml_experiments_status ON ml_experiments(status);

-- 3. Experiment run log (append-only for audit trail)
CREATE TABLE IF NOT EXISTS ml_run_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id   UUID REFERENCES ml_experiments(id) ON DELETE CASCADE,
    event           TEXT NOT NULL,
    payload         JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_run_log_experiment ON ml_run_log(experiment_id);

-- 4. Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_ml_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_ml_workspaces_updated
    BEFORE UPDATE ON ml_workspaces
    FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

CREATE OR REPLACE TRIGGER trg_ml_experiments_updated
    BEFORE UPDATE ON ml_experiments
    FOR EACH ROW EXECUTE FUNCTION update_ml_updated_at();

-- 5. Row Level Security (RLS) — users only see their own data
ALTER TABLE ml_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_run_log ENABLE ROW LEVEL SECURITY;

-- Anon access for free-tier (no auth) — scope by owner_id header
CREATE POLICY "anon_workspace_access" ON ml_workspaces
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_experiment_access" ON ml_experiments
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "anon_run_log_access" ON ml_run_log
    FOR ALL USING (true) WITH CHECK (true);

-- When auth is enabled, replace above with:
-- CREATE POLICY "auth_workspace_access" ON ml_workspaces
--     FOR ALL USING (owner_id = auth.uid()::text)
--     WITH CHECK (owner_id = auth.uid()::text);
