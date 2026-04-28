CREATE TABLE IF NOT EXISTS presentation_runs (
  id TEXT PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  intent JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  outline JSONB NOT NULL DEFAULT '{}'::jsonb,
  slides JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  source VARCHAR(40) NOT NULL DEFAULT 'business-dock',
  classification_level VARCHAR(20) NOT NULL DEFAULT 'internal',
  user_id TEXT NOT NULL,
  tenant_id TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presentation_runs_status_idx
  ON presentation_runs (status);

CREATE INDEX IF NOT EXISTS presentation_runs_user_id_idx
  ON presentation_runs (user_id);

CREATE INDEX IF NOT EXISTS presentation_runs_tenant_id_idx
  ON presentation_runs (tenant_id);

CREATE INDEX IF NOT EXISTS presentation_runs_updated_at_idx
  ON presentation_runs (updated_at);