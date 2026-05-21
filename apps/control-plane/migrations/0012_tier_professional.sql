-- =============================================================================
-- 0012_tier_professional.sql — Track 25 repricing (179/249/349/549)
-- =============================================================================
-- Adds 'professional' as a valid tier value in the clients.tier CHECK constraint.
-- SQLite doesn't support ALTER COLUMN CHECK, so we rebuild the table.
--
-- Production rollback: keep this migration forward-only — no plan to remove
-- the professional tier once any klient picks it.
-- =============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE clients_new (
  id                    TEXT PRIMARY KEY,
  business_name         TEXT NOT NULL,
  legal_name            TEXT,
  nip                   TEXT UNIQUE,
  regon                 TEXT,
  krs                   TEXT,
  primary_domain        TEXT,
  preview_domain        TEXT,
  cf_worker_name        TEXT,
  cf_zone_id            TEXT,
  github_repo_url       TEXT,
  industry              TEXT NOT NULL,
  subtype_schema        TEXT NOT NULL,
  theme_preset          TEXT NOT NULL CHECK (theme_preset IN (
                            'craftsman', 'professional', 'medical', 'beauty', 'local-services', 'food', 'generic'
                          )),
  theme_variant         TEXT,
  city                  TEXT NOT NULL,
  postal_code           TEXT,
  voivodeship           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'provisioning', 'active', 'paused', 'suspended', 'churned'
                          )),
  -- TRACK 25: added 'professional' tier
  tier                  TEXT NOT NULL CHECK (tier IN ('starter', 'standard', 'premium', 'professional')),
  has_lock_in           INTEGER NOT NULL DEFAULT 0,
  lock_in_until         TEXT,
  signed_dpa_at         TEXT,
  signed_dpa_version    TEXT,
  signed_dpa_pdf_r2_key TEXT,
  referral_code         TEXT UNIQUE,
  referred_by           TEXT REFERENCES clients_new(id) ON DELETE SET NULL,
  api_key_hash          TEXT,
  api_key_hash_new      TEXT,
  api_key_rotated_at    TEXT,
  feature_flags_json    TEXT NOT NULL DEFAULT '{}',
  modules_json          TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at          TEXT,
  churned_at            TEXT,
  notes                 TEXT
);

INSERT INTO clients_new SELECT * FROM clients;
DROP TABLE clients;
ALTER TABLE clients_new RENAME TO clients;

-- Indexes (recreate — they were on the old table)
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_nip ON clients(nip) WHERE nip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_primary_domain ON clients(primary_domain) WHERE primary_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);

PRAGMA foreign_keys = ON;
