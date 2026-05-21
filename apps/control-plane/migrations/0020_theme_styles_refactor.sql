-- Migration 0020: Theme styles refactor (Track 26 round 3)
-- Rozszerza CHECK constraint dla clients.theme_preset z branżowych (craftsman/beauty/food/professional)
-- na stylowe (minimalist/elegant/dynamic/editorial) + zachowuje wsteczną kompatybilność.

PRAGMA foreign_keys = OFF;

-- 1. Create new table with expanded CHECK + EXACT current schema (36 columns)
CREATE TABLE clients_new (
  id                    TEXT PRIMARY KEY,
  business_name         TEXT NOT NULL,
  legal_name            TEXT,
  nip                   TEXT NOT NULL,
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
                            'minimalist', 'elegant', 'dynamic', 'editorial',
                            'craftsman', 'professional', 'medical', 'beauty', 'local-services', 'food', 'generic'
                          )),
  theme_variant         TEXT,
  city                  TEXT NOT NULL,
  postal_code           TEXT,
  voivodeship           TEXT,
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                            'pending', 'provisioning', 'active', 'paused', 'suspended', 'churned'
                          )),
  tier                  TEXT NOT NULL CHECK (tier IN ('starter', 'standard', 'premium', 'professional')),
  has_lock_in           INTEGER NOT NULL DEFAULT 0,
  lock_in_until         TEXT,
  signed_dpa_at         TEXT,
  signed_dpa_version    TEXT,
  signed_dpa_pdf_r2_key TEXT,
  referral_code         TEXT,
  referred_by           TEXT,
  api_key_hash          TEXT,
  api_key_hash_new      TEXT,
  api_key_rotated_at    TEXT,
  feature_flags_json    TEXT,
  modules_json          TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at          TEXT,
  churned_at            TEXT,
  notes                 TEXT
);

-- 2. Copy data with explicit column mapping
INSERT INTO clients_new (
  id, business_name, legal_name, nip, regon, krs, primary_domain, preview_domain,
  cf_worker_name, cf_zone_id, github_repo_url, industry, subtype_schema, theme_preset,
  theme_variant, city, postal_code, voivodeship, status, tier, has_lock_in, lock_in_until,
  signed_dpa_at, signed_dpa_version, signed_dpa_pdf_r2_key, referral_code, referred_by,
  api_key_hash, api_key_hash_new, api_key_rotated_at, feature_flags_json, modules_json,
  created_at, activated_at, churned_at, notes
) SELECT
  id, business_name, legal_name, nip, regon, krs, primary_domain, preview_domain,
  cf_worker_name, cf_zone_id, github_repo_url, industry, subtype_schema, theme_preset,
  theme_variant, city, postal_code, voivodeship, status, tier, has_lock_in, lock_in_until,
  signed_dpa_at, signed_dpa_version, signed_dpa_pdf_r2_key, referral_code, referred_by,
  api_key_hash, api_key_hash_new, api_key_rotated_at, feature_flags_json, modules_json,
  created_at, activated_at, churned_at, notes
FROM clients;

-- 3. Drop old, rename new
DROP TABLE clients;
ALTER TABLE clients_new RENAME TO clients;

-- 4. Recreate indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_nip ON clients(nip);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_tier ON clients(tier);
CREATE INDEX IF NOT EXISTS idx_clients_primary_domain ON clients(primary_domain);
CREATE INDEX IF NOT EXISTS idx_clients_cf_worker_name ON clients(cf_worker_name);

PRAGMA foreign_keys = ON;
