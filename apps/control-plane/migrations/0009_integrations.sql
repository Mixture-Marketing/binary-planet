-- =============================================================================
-- 0009_integrations.sql — External integrations + feature flag overrides + auth
-- =============================================================================
--   * client_integrations — per-klient connections (GBP, GSC, GA4, OAuth tokens)
--   * feature_flag_overrides — admin force-flag per klient (sparingly)
--   * admin_users + admin_sessions — internal panel auth (Jakub + VA later)
--   * panel_klienta_sessions — magic link auth dla klientów (Q.5)
-- =============================================================================

-- Per-klient external service connections
-- One row per klient × integration. Tokens encrypted at app layer.
CREATE TABLE client_integrations (
  id                    TEXT PRIMARY KEY,                       -- 'cint_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  integration           TEXT NOT NULL CHECK (integration IN (
                            'gbp',           -- Google Business Profile
                            'gsc',           -- Google Search Console
                            'ga4',           -- Google Analytics 4
                            'google_ads',
                            'meta_pixel',
                            'meta_ads',
                            'tiktok_pixel',
                            'bing_webmaster',
                            'apple_business_connect',
                            'clarity',
                            'plausible'
                          )),

  -- Identifiers (non-secret, public-ish)
  external_id           TEXT,                                   -- GBP location name, GSC property URL, GA4 property ID, etc.
  external_account_id   TEXT,                                   -- google_ads customer ID, etc.

  -- Auth method (3 paths per plan I.4)
  auth_method           TEXT NOT NULL CHECK (auth_method IN (
                            'service_account',                   -- preferred — one SA for all klientów
                            'oauth_refresh',                     -- klient OAuth'd, re-auth every 6mc
                            'api_key',                           -- klient pasted manual key
                            'manual_csv',                        -- fallback — klient uploads CSV
                            'unmanaged'                          -- klient handles it themselves
                          )),

  -- Encrypted token storage (per-tenant encryption key)
  oauth_refresh_token_enc TEXT,                                 -- if oauth_refresh
  oauth_access_token_enc  TEXT,                                 -- cached, re-fetched from refresh
  oauth_token_expires_at  TEXT,
  oauth_scopes_json       TEXT,                                 -- ['webmasters.readonly', 'analytics.readonly']
  api_key_enc           TEXT,                                   -- if api_key

  -- State
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'connected', 'reauth_required', 'failed', 'disconnected', 'unmanaged'
                          )),
  connected_at          TEXT,
  last_synced_at        TEXT,
  last_error            TEXT,
  consecutive_failures  INTEGER NOT NULL DEFAULT 0,

  -- Sync schedule
  sync_frequency        TEXT CHECK (sync_frequency IN ('hourly', 'daily', 'weekly', 'manual', 'realtime')),
  next_sync_at          TEXT,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_client_integrations_unique ON client_integrations(client_id, integration);
CREATE INDEX idx_client_integrations_sync_queue ON client_integrations(next_sync_at) WHERE status = 'connected';
CREATE INDEX idx_client_integrations_reauth ON client_integrations(status) WHERE status = 'reauth_required';
CREATE INDEX idx_client_integrations_failing ON client_integrations(consecutive_failures DESC) WHERE consecutive_failures > 0;

-- Feature flag overrides (sparingly used — most flags come from client.config.ts build-time)
CREATE TABLE feature_flag_overrides (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             TEXT REFERENCES clients(id) ON DELETE CASCADE,  -- NULL for global override

  flag_key              TEXT NOT NULL,                          -- 'ai_blog_enabled', 'turnstile_required', 'maintenance_mode'
  value_json            TEXT NOT NULL,                          -- typed JSON: true/false, number, string, object

  enabled               INTEGER NOT NULL DEFAULT 1,             -- BOOLEAN — kill switch
  reason                TEXT,                                   -- 'incident:P1-form-broken', 'a/b test', 'klient request'

  expires_at            TEXT,                                   -- TTL — flags often temporary
  created_by            TEXT NOT NULL,                          -- 'admin:<email>' | 'system'
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_feature_flags_client_key ON feature_flag_overrides(COALESCE(client_id, '__global__'), flag_key);
CREATE INDEX idx_feature_flags_active ON feature_flag_overrides(enabled, expires_at);

-- Admin users (Jakub + future VAs)
CREATE TABLE admin_users (
  id                    TEXT PRIMARY KEY,                       -- 'usr_<random>'
  email                 TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,

  role                  TEXT NOT NULL CHECK (role IN ('admin', 'va', 'read_only', 'billing_only')),
  permissions_json      TEXT NOT NULL DEFAULT '[]',             -- granular permissions on top of role

  -- Auth (passwordless preferred — WebAuthn / magic link)
  webauthn_credentials_json TEXT,                               -- registered passkeys
  totp_secret_enc       TEXT,                                   -- 2FA fallback (encrypted)
  recovery_codes_hash_json TEXT,                                -- 8 x sha256 (one-time)

  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'disabled')),
  last_login_at         TEXT,
  last_login_ip_hash    TEXT,

  notes                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at           TEXT
);

CREATE INDEX idx_admin_users_status ON admin_users(status);

-- Admin sessions (server-side session for admin panel)
CREATE TABLE admin_sessions (
  id                    TEXT PRIMARY KEY,                       -- session token (random 256-bit)
  user_id               TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,

  ip_hash               TEXT,
  user_agent_family     TEXT,
  device_fingerprint    TEXT,                                   -- for anomaly detection

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  last_active_at        TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at            TEXT NOT NULL,
  revoked_at            TEXT
);

CREATE INDEX idx_admin_sessions_user ON admin_sessions(user_id, expires_at);
CREATE INDEX idx_admin_sessions_active ON admin_sessions(expires_at) WHERE revoked_at IS NULL;

-- Klient panel sessions (Q.5 — magic link auth dla klientów)
CREATE TABLE panel_sessions (
  id                    TEXT PRIMARY KEY,                       -- session token
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Magic link flow
  magic_link_token_hash TEXT NOT NULL,                          -- sha256 of original token (one-time use)
  magic_link_sent_to_email_hash TEXT NOT NULL,
  magic_link_consumed_at TEXT,                                  -- when token was redeemed (NULL = unused)

  ip_hash               TEXT,
  user_agent_family     TEXT,

  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at            TEXT NOT NULL,
  last_active_at        TEXT,
  revoked_at            TEXT
);

CREATE INDEX idx_panel_sessions_client ON panel_sessions(client_id, expires_at);
CREATE INDEX idx_panel_sessions_token_lookup ON panel_sessions(magic_link_token_hash);

-- Schema version tracking (for migrations runner)
CREATE TABLE schema_migrations (
  version               INTEGER PRIMARY KEY,
  name                  TEXT NOT NULL,
  applied_at            TEXT NOT NULL DEFAULT (datetime('now')),
  checksum              TEXT NOT NULL                           -- sha256 of migration file content — detect tampering
);

-- Seed with this batch
INSERT INTO schema_migrations (version, name, checksum) VALUES
  (1, '0001_init_clients',   'TODO_checksum_at_runner_time'),
  (2, '0002_billing',        'TODO_checksum_at_runner_time'),
  (3, '0003_leads',          'TODO_checksum_at_runner_time'),
  (4, '0004_seo_metrics',    'TODO_checksum_at_runner_time'),
  (5, '0005_gbp_blog',       'TODO_checksum_at_runner_time'),
  (6, '0006_compliance',     'TODO_checksum_at_runner_time'),
  (7, '0007_ops',            'TODO_checksum_at_runner_time'),
  (8, '0008_crm',            'TODO_checksum_at_runner_time'),
  (9, '0009_integrations',   'TODO_checksum_at_runner_time');
