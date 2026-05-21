-- =============================================================================
-- 0013_competitor_monitoring.sql — Monitoring konkurencji addon (Track 24f-3)
-- =============================================================================
-- Per-klient configuration of competitors + keywords + weekly SERP snapshots.
--
-- Cron `competitor_check_weekly` reads competitor_monitoring_config rows where
-- client has active `competitor_monitoring` addon, queries DataForSEO, stores
-- positions in competitor_snapshots, sends weekly HTML email.
-- =============================================================================

CREATE TABLE competitor_monitoring_config (
  client_id          TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  competitor_domains_json  TEXT NOT NULL DEFAULT '[]',  -- ["konkurent1.pl", "konkurent2.pl", ...]  (max 3)
  keywords_json            TEXT NOT NULL DEFAULT '[]',  -- ["ślusarz warszawa", ...]  (max 10)
  location_name            TEXT,                        -- "Warszawa, Mazowieckie, Poland" (DataForSEO location format)
  location_code            INTEGER,                     -- DataForSEO location code (e.g. 21167 = Warszawa)
  search_language          TEXT NOT NULL DEFAULT 'pl',
  search_engine            TEXT NOT NULL DEFAULT 'google',
  last_run_at              TEXT,
  last_email_sent_at       TEXT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE competitor_snapshots (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id          TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- ISO week (YYYY-Www) — one snapshot per klient per week per keyword
  week_id            TEXT NOT NULL,
  taken_at           TEXT NOT NULL DEFAULT (datetime('now')),
  keyword            TEXT NOT NULL,
  -- Map: domain → position (or null if not in top 100). Includes client's own domain.
  positions_json     TEXT NOT NULL,
  -- Cost in cents/grosze charged by DataForSEO for this query (tracking budget)
  cost_grosze        INTEGER NOT NULL DEFAULT 0,
  -- Raw subset of DataForSEO response (top 10 SERP organic results)
  raw_top10_json     TEXT
);

CREATE INDEX idx_competitor_snapshots_client_week ON competitor_snapshots(client_id, week_id);
CREATE INDEX idx_competitor_snapshots_keyword ON competitor_snapshots(keyword, week_id);
