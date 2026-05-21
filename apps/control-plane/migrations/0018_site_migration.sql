-- =============================================================================
-- 0018_site_migration.sql — Track 24f-9 site migration addon (299 zł 1×)
-- =============================================================================
-- Tracks site migration runs per klient: source URL, pages discovered, report key.
-- =============================================================================

CREATE TABLE migration_runs (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed')),
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at     TEXT,
  pages_found     INTEGER NOT NULL DEFAULT 0,
  pages_scraped   INTEGER NOT NULL DEFAULT 0,
  report_r2_key   TEXT,
  error_message   TEXT,
  metadata_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_migration_runs_client ON migration_runs(client_id, started_at DESC);
