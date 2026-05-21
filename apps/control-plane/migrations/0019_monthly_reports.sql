-- =============================================================================
-- 0019_monthly_reports.sql — Klient monthly reports
-- =============================================================================
-- Stores monthly summary reports generated for each klient.
-- Cron monthly_reports (already in scheduled dispatcher) fills this.
-- Klient widzi w /raporty + dostaje email z PDF link.
-- =============================================================================

CREATE TABLE monthly_reports (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- ISO month (YYYY-MM)
  month_id        TEXT NOT NULL,
  -- Brief summary visible in panel list
  summary         TEXT NOT NULL,
  -- Full JSON: leads_count, top_pages, gbp_stats, addon_usage, recommendations
  report_json     TEXT NOT NULL,
  -- R2 key for PDF (optional, generated separately)
  pdf_r2_key      TEXT,
  generated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  email_sent_at   TEXT,
  UNIQUE(client_id, month_id)
);

CREATE INDEX idx_monthly_reports_client ON monthly_reports(client_id, month_id DESC);
