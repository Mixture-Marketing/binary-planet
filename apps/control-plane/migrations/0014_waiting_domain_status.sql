-- =============================================================================
-- 0014_waiting_domain_status.sql — Track 19b multi-tick OVH order polling
-- =============================================================================
-- Adds:
--   - 'waiting_domain' to provisioning_status CHECK constraint
--     (cron sees row in this state → polls OVH order → resumes when delivered)
--   - pending_order_id column (OVH order ID we're polling)
--   - pending_order_first_seen_at (timeout tracking)
-- =============================================================================

PRAGMA foreign_keys = OFF;

CREATE TABLE client_provisioning_configs_new (
  client_id             TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  config_json           TEXT NOT NULL,
  wizard_version        TEXT NOT NULL DEFAULT 'v1',
  created_by_user_id    TEXT,
  generated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  -- TRACK 19b: added 'waiting_domain' for multi-tick OVH order polling
  provisioning_status   TEXT NOT NULL DEFAULT 'pending' CHECK (provisioning_status IN (
                            'pending', 'running', 'done', 'failed', 'waiting_domain'
                          )),
  provisioning_started_at  TEXT,
  provisioning_finished_at TEXT,
  provisioning_error    TEXT,
  steps_json            TEXT NOT NULL DEFAULT '[]',
  -- TRACK 19b: OVH order tracking for async domain purchase
  pending_order_id              TEXT,
  pending_order_first_seen_at   TEXT
);

INSERT INTO client_provisioning_configs_new
  (client_id, config_json, wizard_version, created_by_user_id, generated_at,
   provisioning_status, provisioning_started_at, provisioning_finished_at,
   provisioning_error, steps_json)
SELECT
  client_id, config_json, wizard_version, created_by_user_id, generated_at,
  provisioning_status, provisioning_started_at, provisioning_finished_at,
  provisioning_error, steps_json
FROM client_provisioning_configs;

DROP TABLE client_provisioning_configs;
ALTER TABLE client_provisioning_configs_new RENAME TO client_provisioning_configs;

CREATE INDEX IF NOT EXISTS idx_provisioning_status ON client_provisioning_configs(provisioning_status);
CREATE INDEX IF NOT EXISTS idx_provisioning_waiting ON client_provisioning_configs(pending_order_id)
  WHERE provisioning_status = 'waiting_domain';

PRAGMA foreign_keys = ON;
