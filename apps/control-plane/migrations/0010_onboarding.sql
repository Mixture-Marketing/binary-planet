-- =============================================================================
-- 0010_onboarding.sql — Onboarding wizard output (Track 1)
-- =============================================================================
-- Stores the generated client.config payload that the provisioning worker (Track 4)
-- will commit to the klient's repo as `src/client.config.ts`.
--
-- One row per client. Generated at end of onboarding wizard. Read-only after
-- provisioning starts (klient edits via panel klienta → that updates separate
-- editable fields in client_settings, NOT this provisioning snapshot).
-- =============================================================================

CREATE TABLE client_provisioning_configs (
  client_id             TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  -- Full ClientConfig serialized as JSON. Provisioning worker reads this,
  -- runs through zod validator (client.config.schema.ts), then writes as TS.
  config_json           TEXT NOT NULL,
  -- Version of the wizard that produced this — for future migrations.
  wizard_version        TEXT NOT NULL DEFAULT 'v1',
  -- Admin user that ran the wizard (audit).
  created_by_user_id    TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  generated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  -- Provisioning lifecycle — separate from clients.status (which covers full lifecycle).
  -- Updated by Track 4 worker as it walks through OVH → GitHub → CF deploy.
  provisioning_status   TEXT NOT NULL DEFAULT 'pending' CHECK (provisioning_status IN (
                            'pending', 'running', 'done', 'failed'
                          )),
  provisioning_started_at  TEXT,
  provisioning_finished_at TEXT,
  provisioning_error    TEXT,
  -- Each step the worker runs reports here.
  steps_json            TEXT NOT NULL DEFAULT '[]'              -- [{step:'ovh_register', ok:true, ts:'...'}, ...]
);

CREATE INDEX idx_provisioning_status ON client_provisioning_configs(provisioning_status, generated_at)
  WHERE provisioning_status IN ('pending', 'running', 'failed');
