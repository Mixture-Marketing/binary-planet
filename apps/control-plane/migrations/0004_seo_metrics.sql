-- =============================================================================
-- 0004_seo_metrics.sql — SEO/CWV/local pack tracking
-- =============================================================================
-- Daily/weekly/monthly snapshots from external APIs:
--   * GSC (Search Analytics — clicks, impressions, CTR, position) — daily
--   * GA4 (Data API — sessions, users, conversions) — daily
--   * GBP (Insights — views, calls, directions, photo views) — daily
--   * Lighthouse CI (perf, a11y, seo, best practices) — per deploy
--   * CrUX field data (LCP, INP, CLS) — weekly
--   * DataForSEO (keyword rankings, local pack) — weekly
--   * Synthetic monitor (uptime, response time) — every 5 min
-- =============================================================================

CREATE TABLE seo_metrics (
  id                    TEXT PRIMARY KEY,                       -- 'seom_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date         TEXT NOT NULL,                          -- ISO date YYYY-MM-DD

  -- Google Search Console (daily aggregates)
  gsc_clicks            INTEGER,
  gsc_impressions       INTEGER,
  gsc_ctr               REAL,                                   -- 0.0–1.0
  gsc_avg_position      REAL,

  -- Google Analytics 4
  ga4_sessions          INTEGER,
  ga4_users             INTEGER,
  ga4_new_users         INTEGER,
  ga4_engagement_rate   REAL,
  ga4_conversions       INTEGER,
  ga4_conversion_value  INTEGER,                                -- grosze

  -- GBP Insights
  gbp_views             INTEGER,
  gbp_searches          INTEGER,                                -- impressions in search results
  gbp_maps_views        INTEGER,                                -- impressions in maps
  gbp_calls             INTEGER,
  gbp_directions        INTEGER,
  gbp_website_clicks    INTEGER,
  gbp_photo_views       INTEGER,
  gbp_message_clicks    INTEGER,

  -- Lighthouse (latest per snapshot_date, 0–100 scores)
  lighthouse_perf       INTEGER CHECK (lighthouse_perf BETWEEN 0 AND 100),
  lighthouse_a11y       INTEGER CHECK (lighthouse_a11y BETWEEN 0 AND 100),
  lighthouse_seo        INTEGER CHECK (lighthouse_seo BETWEEN 0 AND 100),
  lighthouse_bp         INTEGER CHECK (lighthouse_bp BETWEEN 0 AND 100),

  -- Core Web Vitals (CrUX field data — p75 thresholds)
  cwv_lcp_ms            INTEGER,
  cwv_inp_ms            INTEGER,                                -- INP replaced FID March 2024
  cwv_cls               REAL,                                   -- typically 0.0–0.3
  cwv_ttfb_ms           INTEGER,
  cwv_fcp_ms            INTEGER,
  cwv_passing_pct       REAL,                                   -- % of pages passing all CWV thresholds

  -- Uptime + reliability (aggregated from health_checks daily)
  uptime_pct            REAL,                                   -- 0.0–1.0
  avg_response_ms       INTEGER,
  errors_count          INTEGER,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_seo_metrics_client_date ON seo_metrics(client_id, snapshot_date);
CREATE INDEX idx_seo_metrics_date ON seo_metrics(snapshot_date DESC);

-- Keyword rankings (DataForSEO snapshots — weekly)
CREATE TABLE keyword_rankings (
  id                    TEXT PRIMARY KEY,                       -- 'kr_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword               TEXT NOT NULL,
  location              TEXT NOT NULL,                          -- 'Rzeszów, Polska'
  device                TEXT NOT NULL CHECK (device IN ('desktop', 'mobile')),
  search_engine         TEXT NOT NULL DEFAULT 'google_pl',
  snapshot_date         TEXT NOT NULL,                          -- ISO date

  position              INTEGER,                                -- NULL if not in top 100
  url                   TEXT,                                   -- ranked URL on client domain
  in_local_pack         INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN (3-pack appearance)
  local_pack_position   INTEGER CHECK (local_pack_position BETWEEN 1 AND 3),
  in_ai_overview        INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — Google AI Overview citation
  in_knowledge_panel    INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN

  search_volume         INTEGER,                                -- DataForSEO monthly avg
  cpc_grosze            INTEGER,                                -- average CPC
  competition           REAL,                                   -- 0.0–1.0

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_keyword_rankings_client_date ON keyword_rankings(client_id, snapshot_date DESC);
CREATE INDEX idx_keyword_rankings_keyword ON keyword_rankings(keyword, snapshot_date DESC);
CREATE INDEX idx_keyword_rankings_local_pack ON keyword_rankings(client_id, in_local_pack, snapshot_date) WHERE in_local_pack = 1;

-- Citation submissions to PL directories (Faza 5)
CREATE TABLE citations (
  id                    TEXT PRIMARY KEY,                       -- 'cit_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  directory             TEXT NOT NULL,                          -- 'pkt.pl', 'panoramafirm', 'aleo', 'bing_places', etc.
  directory_tier        INTEGER NOT NULL CHECK (directory_tier IN (1, 2, 3)),  -- 1=high authority, 3=niche

  status                TEXT NOT NULL CHECK (status IN (
                            'queued', 'submitted', 'pending_verification', 'verified', 'live', 'failed', 'rejected', 'duplicate'
                          )),
  submission_method     TEXT CHECK (submission_method IN ('api', 'manual', 'csv_import')),

  submitted_at          TEXT,
  verified_at           TEXT,
  live_at               TEXT,
  listing_url           TEXT,                                   -- public URL when live
  screenshot_r2_key     TEXT,                                   -- proof of submission

  error_message         TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  next_retry_at         TEXT,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_citations_client_directory ON citations(client_id, directory);
CREATE INDEX idx_citations_status ON citations(status, next_retry_at) WHERE status IN ('queued', 'failed');
CREATE INDEX idx_citations_live ON citations(client_id, live_at) WHERE status = 'live';

-- Health checks (synthetic monitor, every 5 min)
-- High write volume — older rows pruned monthly via cron.
CREATE TABLE health_checks (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  checked_at            TEXT NOT NULL,
  http_status           INTEGER,
  response_time_ms      INTEGER,
  uptime                INTEGER NOT NULL,                       -- BOOLEAN — passed health check
  ssl_valid             INTEGER,                                -- BOOLEAN, NULL if not checked
  ssl_expires_at        TEXT,                                   -- only updated on successful SSL fetch (daily, not 5min)
  error_message         TEXT,
  region                TEXT                                    -- CF colo
);

CREATE INDEX idx_health_checks_client_time ON health_checks(client_id, checked_at DESC);
CREATE INDEX idx_health_checks_failures ON health_checks(client_id, uptime, checked_at) WHERE uptime = 0;
CREATE INDEX idx_health_checks_ssl_expiring ON health_checks(ssl_expires_at) WHERE ssl_expires_at IS NOT NULL;
