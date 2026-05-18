-- =============================================================================
-- 0007_ops.sql — Operational tables (idempotency, secrets, cron, AI cost tracking)
-- =============================================================================
-- Source of truth for runbook scenarios:
--   * webhook_events — Stripe/P24 idempotency (P1-stripe-webhook-failure.md)
--   * secrets_inventory + secret_rotation_log (ops-rotate-secrets.md)
--   * cron_runs / job_runs (P2-gbp-api-down.md)
--   * ai_calls — Anthropic cost tracking (P2-anthropic-rate-limit.md)
--   * alerts — P1/P2/P3 event log (alert-routing.md)
-- =============================================================================

-- Webhook idempotency (Stripe, P24, GitHub) — record each event ID we've processed
CREATE TABLE webhook_events (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  source                TEXT NOT NULL CHECK (source IN ('stripe', 'przelewy24', 'github', 'fakturownia', 'resend')),
  external_event_id     TEXT NOT NULL,                          -- evt_xxx from provider
  event_type            TEXT NOT NULL,                          -- 'checkout.session.completed', 'customer.subscription.updated', etc.

  status                TEXT NOT NULL CHECK (status IN ('received', 'processing', 'processed', 'failed', 'skipped')),
  retry_count           INTEGER NOT NULL DEFAULT 0,
  error                 TEXT,

  payload_r2_key        TEXT,                                   -- full payload archived in R2 (optional — for replay)
  signature_verified    INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN

  received_at           TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at          TEXT,
  metadata_json         TEXT
);

CREATE UNIQUE INDEX idx_webhook_events_dedupe ON webhook_events(source, external_event_id);
CREATE INDEX idx_webhook_events_failed ON webhook_events(status, received_at) WHERE status IN ('failed', 'processing');
CREATE INDEX idx_webhook_events_type ON webhook_events(source, event_type, received_at DESC);

-- Secrets inventory (runbooks/secrets-inventory.md)
CREATE TABLE secrets_inventory (
  id                    TEXT PRIMARY KEY,                       -- 'sec_<random>'
  client_id             TEXT REFERENCES clients(id) ON DELETE CASCADE,  -- NULL for shared secrets

  secret_type           TEXT NOT NULL,                          -- 'anthropic_api_key', 'bp_client_api_key', 'stripe_webhook_secret', etc.
  scope                 TEXT NOT NULL CHECK (scope IN ('shared', 'per_client', 'backup', 'admin')),
  worker_name           TEXT,                                   -- where the secret lives (NULL for non-Worker secrets like Stripe panel)
  worker_secret_name    TEXT,                                   -- env var name in Worker (e.g. 'ANTHROPIC_API_KEY')

  -- Versioning
  current_version       INTEGER NOT NULL DEFAULT 1,
  kid                   TEXT NOT NULL,                          -- key ID, used for verification w API responses (rolling rotation)
  previous_kid          TEXT,                                   -- during 7-day grace period

  -- Lifecycle
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at            TEXT,
  expires_at            TEXT,                                   -- when next rotation due
  last_used_at          TEXT,                                   -- if we track usage; updated by audit_log
  revoked_at            TEXT,

  rotation_policy       TEXT NOT NULL CHECK (rotation_policy IN (
                            'quarterly', 'semi_annual', 'annual', 'on_demand', 'never'
                          )),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                            'active', 'pending_rotation', 'rotating', 'expired', 'revoked', 'compromised'
                          )),

  -- Provenance (where this secret came from)
  provider              TEXT,                                   -- 'anthropic', 'stripe', 'self_generated', etc.
  notes                 TEXT
);

CREATE INDEX idx_secrets_status_expires ON secrets_inventory(status, expires_at) WHERE status = 'active';
CREATE INDEX idx_secrets_client ON secrets_inventory(client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX idx_secrets_scope_type_client ON secrets_inventory(scope, secret_type, COALESCE(client_id, ''));

-- Rotation log (audit + grace period tracking)
CREATE TABLE secret_rotation_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  secret_id             TEXT NOT NULL REFERENCES secrets_inventory(id) ON DELETE CASCADE,
  rotated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_by            TEXT NOT NULL,                          -- 'system' | 'admin:<email>'
  reason                TEXT NOT NULL CHECK (reason IN (
                            'scheduled', 'on_demand', 'incident', 'compromise', 'employee_offboarding', 'policy_change'
                          )),

  old_kid               TEXT,
  new_kid               TEXT NOT NULL,
  grace_period_until    TEXT,                                   -- old kid still accepted until this date

  success               INTEGER NOT NULL DEFAULT 1,             -- BOOLEAN
  error                 TEXT,
  metadata_json         TEXT
);

CREATE INDEX idx_secret_rotation_secret_time ON secret_rotation_log(secret_id, rotated_at DESC);

-- Cron / scheduled job runs (visibility into background workflows)
CREATE TABLE cron_runs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  job_name              TEXT NOT NULL,                          -- 'gsc_daily_pull', 'gbp_daily_pull', 'health_check_5min', 'backup_daily', etc.
  cron_expression       TEXT,                                   -- e.g. '0 2 * * *'

  started_at            TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at           TEXT,
  duration_ms           INTEGER,

  status                TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_success', 'failed', 'timeout', 'skipped')),
  items_processed       INTEGER NOT NULL DEFAULT 0,
  items_failed          INTEGER NOT NULL DEFAULT 0,
  error                 TEXT,

  metadata_json         TEXT
);

CREATE INDEX idx_cron_runs_job_started ON cron_runs(job_name, started_at DESC);
CREATE INDEX idx_cron_runs_failures ON cron_runs(status, started_at DESC) WHERE status IN ('failed', 'timeout', 'partial_success');

-- AI calls (cost tracking + abuse detection — P2-anthropic-rate-limit.md)
CREATE TABLE ai_calls (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             TEXT REFERENCES clients(id) ON DELETE SET NULL,
  caller                TEXT NOT NULL,                          -- 'onboarding_wizard', 'blog_draft', 'review_response', 'admin'

  provider              TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google_ai')),
  model                 TEXT NOT NULL,                          -- 'claude-opus-4-7', 'claude-sonnet-4-6', etc.

  input_tokens          INTEGER NOT NULL,
  output_tokens         INTEGER NOT NULL,
  cache_read_tokens     INTEGER,                                -- prompt caching
  cache_write_tokens    INTEGER,
  cost_grosze           INTEGER NOT NULL,                       -- computed at insert time using current pricing

  latency_ms            INTEGER,
  success               INTEGER NOT NULL DEFAULT 1,
  http_status           INTEGER,
  error_code            TEXT,
  error_message         TEXT,

  prompt_template       TEXT,                                   -- ID for tracking which template was used
  request_id            TEXT,                                   -- for distributed tracing
  occurred_at           TEXT NOT NULL DEFAULT (datetime('now')),

  metadata_json         TEXT
);

CREATE INDEX idx_ai_calls_client_time ON ai_calls(client_id, occurred_at DESC) WHERE client_id IS NOT NULL;
CREATE INDEX idx_ai_calls_caller_time ON ai_calls(caller, occurred_at DESC);
CREATE INDEX idx_ai_calls_provider_time ON ai_calls(provider, occurred_at DESC);
CREATE INDEX idx_ai_calls_failed ON ai_calls(occurred_at DESC) WHERE success = 0;
-- For daily cost roll-up:
CREATE INDEX idx_ai_calls_daily_cost ON ai_calls(provider, occurred_at);

-- Alert events (P1/P2/P3 — what fired, was it ACKed, was it resolved)
CREATE TABLE alerts (
  id                    TEXT PRIMARY KEY,                       -- 'alt_<random>'
  severity              TEXT NOT NULL CHECK (severity IN ('P1', 'P2', 'P3', 'P4')),
  alert_type            TEXT NOT NULL,                          -- 'site_offline', 'ssl_expiring', 'stripe_webhook_fail', etc.

  client_id             TEXT REFERENCES clients(id) ON DELETE SET NULL,  -- NULL for platform-wide
  resource_type         TEXT,
  resource_id           TEXT,

  title                 TEXT NOT NULL,
  description           TEXT,
  runbook_url           TEXT,                                   -- 'https://github.com/.../runbooks/P1-site-offline.md'

  status                TEXT NOT NULL CHECK (status IN ('open', 'acked', 'resolved', 'auto_resolved', 'flapping')),
  fired_at              TEXT NOT NULL DEFAULT (datetime('now')),
  acked_at              TEXT,
  acked_by              TEXT,
  resolved_at           TEXT,
  resolved_by           TEXT,
  duration_ms           INTEGER,                                -- fired_at → resolved_at

  -- Deduplication
  dedup_key             TEXT,                                   -- KV dedup hash, prevents repeat fires within 5min window
  dedup_count           INTEGER NOT NULL DEFAULT 1,             -- if dedup'd, counts how many would've fired

  -- Routing
  channels_notified_json TEXT NOT NULL DEFAULT '[]',            -- ['sms:jakub', 'email:jakub', 'slack:critical']

  metadata_json         TEXT
);

CREATE INDEX idx_alerts_open ON alerts(severity, fired_at DESC) WHERE status IN ('open', 'acked');
CREATE INDEX idx_alerts_client ON alerts(client_id, fired_at DESC) WHERE client_id IS NOT NULL;
CREATE INDEX idx_alerts_type_time ON alerts(alert_type, fired_at DESC);
CREATE INDEX idx_alerts_dedup ON alerts(dedup_key, fired_at) WHERE dedup_key IS NOT NULL;

-- Background queue (lightweight task queue — for tasks not worth CF Queues yet)
CREATE TABLE background_jobs (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  queue                 TEXT NOT NULL DEFAULT 'default',
  job_type              TEXT NOT NULL,                          -- 'send_review_request', 'sync_gbp', 'generate_blog_brief', etc.
  payload_json          TEXT NOT NULL,

  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                            'queued', 'running', 'success', 'failed', 'dead'
                          )),
  attempts              INTEGER NOT NULL DEFAULT 0,
  max_attempts          INTEGER NOT NULL DEFAULT 3,
  next_run_at           TEXT NOT NULL DEFAULT (datetime('now')),

  client_id             TEXT REFERENCES clients(id) ON DELETE CASCADE,
  started_at            TEXT,
  finished_at           TEXT,
  last_error            TEXT,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_background_jobs_queue ON background_jobs(queue, status, next_run_at) WHERE status = 'queued';
CREATE INDEX idx_background_jobs_client ON background_jobs(client_id, created_at DESC);
