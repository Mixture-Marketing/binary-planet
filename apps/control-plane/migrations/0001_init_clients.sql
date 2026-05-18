-- =============================================================================
-- 0001_init_clients.sql
-- =============================================================================
-- Foundational table. Every other table FKs to clients.
-- Conventions for entire schema:
--   * Primary keys: TEXT for slug/UUID-style IDs, INTEGER AUTOINCREMENT for logs
--   * Timestamps: TEXT in ISO 8601 (datetime('now') default)
--   * BOOLEAN: INTEGER 0/1 (SQLite convention)
--   * Enums: CHECK constraints on TEXT columns
--   * JSON: TEXT columns named *_json, accessed via json_extract()
--   * PII columns marked "-- PII" in comments — must be encrypted at app layer
--     before INSERT/UPDATE (per-tenant key from D1_ENCRYPTION_KEY).
-- =============================================================================

CREATE TABLE clients (
  -- Identity
  id                    TEXT PRIMARY KEY,                       -- slug, e.g. 'slusarz-kowalski-rzeszow' or 'clk_<random>'
  business_name         TEXT NOT NULL,
  legal_name            TEXT,
  nip                   TEXT UNIQUE,                            -- Polish tax ID, 10 digits, validated app-side
  regon                 TEXT,                                   -- Polish business reg, 9 or 14 digits
  krs                   TEXT,                                   -- court reg, optional (spółki)

  -- Site / infra
  primary_domain        TEXT,                                   -- e.g. 'kowalski-slusarz.pl' (no scheme)
  preview_domain        TEXT,                                   -- mm-client-<id>.workers.dev fallback
  cf_worker_name        TEXT,                                   -- 'mm-client-<id>'
  cf_zone_id            TEXT,                                   -- if klient has own zone
  github_repo_url       TEXT,                                   -- 'https://github.com/mixturemarketing/mm-client-<id>'

  -- Classification (drives theme + content prompts)
  industry              TEXT NOT NULL,                          -- 'locksmith', 'auto_repair', 'accountant', etc.
  subtype_schema        TEXT NOT NULL,                          -- LocalBusiness subtype: 'Locksmith', 'AutoRepair', ...
  theme_preset          TEXT NOT NULL CHECK (theme_preset IN (
                            'craftsman', 'professional', 'medical', 'beauty', 'local-services', 'food', 'generic'
                          )),
  theme_variant         TEXT,                                   -- 'red-bold', 'blue-trust', etc.
  city                  TEXT NOT NULL,
  postal_code           TEXT,
  voivodeship           TEXT,

  -- Business state
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'provisioning', 'active', 'paused', 'suspended', 'churned'
                          )),
  tier                  TEXT NOT NULL CHECK (tier IN ('starter', 'standard', 'premium')),
  has_lock_in           INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN
  lock_in_until         TEXT,                                   -- ISO date

  -- Compliance (RODO Art. 28)
  signed_dpa_at         TEXT,                                   -- ISO timestamp — gates 'active' status
  signed_dpa_version    TEXT,                                   -- e.g. 'v1.2' — for tracking which DPA template was signed
  signed_dpa_pdf_r2_key TEXT,                                   -- R2 object key

  -- Referral / affiliate (L.4)
  referral_code         TEXT UNIQUE,                            -- 6-char slug auto-generated on activation
  referred_by           TEXT REFERENCES clients(id) ON DELETE SET NULL,

  -- Auth (spoke ↔ hub)
  api_key_hash          TEXT,                                   -- sha256 of BP_CLIENT_API_KEY
  api_key_hash_new      TEXT,                                   -- during 7-day rotation overlap
  api_key_rotated_at    TEXT,

  -- Configuration overrides (sparingly used; defaults from client.config.ts)
  feature_flags_json    TEXT NOT NULL DEFAULT '{}',             -- per-client overrides for web-core/feature-flags
  modules_json          TEXT NOT NULL DEFAULT '[]',             -- enabled paid modules: ['care', 'reputation', 'blog_ai', ...]

  -- Lifecycle timestamps
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at          TEXT,                                   -- when status first became 'active'
  churned_at            TEXT,
  notes                 TEXT                                    -- internal admin notes
);

CREATE INDEX idx_clients_status ON clients(status) WHERE status IN ('active', 'pending', 'provisioning');
CREATE INDEX idx_clients_tier ON clients(tier);
CREATE INDEX idx_clients_industry ON clients(industry);
CREATE INDEX idx_clients_city ON clients(city);
CREATE INDEX idx_clients_lock_in ON clients(lock_in_until) WHERE lock_in_until IS NOT NULL;
CREATE INDEX idx_clients_referred_by ON clients(referred_by) WHERE referred_by IS NOT NULL;
CREATE UNIQUE INDEX idx_clients_primary_domain ON clients(primary_domain) WHERE primary_domain IS NOT NULL;

-- Contact details (separate table — PII isolation for easier RODO erasure)
-- Encrypted columns marked PII; app layer wraps with per-tenant key.
CREATE TABLE client_contacts (
  client_id             TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  contact_name          TEXT NOT NULL,                          -- PII
  contact_email_enc     TEXT NOT NULL,                          -- PII (encrypted)
  contact_email_hash    TEXT NOT NULL,                          -- sha256 for lookup (deterministic)
  contact_phone_enc     TEXT,                                   -- PII (encrypted)
  contact_phone_hash    TEXT,                                   -- sha256 for lookup
  billing_email_enc     TEXT,                                   -- separate from contact_email (often inny adres do faktur)
  invoice_address_enc   TEXT,                                   -- PII (full address as JSON, encrypted)
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_client_contacts_email_hash ON client_contacts(contact_email_hash);
