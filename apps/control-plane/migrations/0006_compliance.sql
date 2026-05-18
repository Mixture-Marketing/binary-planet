-- =============================================================================
-- 0006_compliance.sql — RODO compliance scaffolding
-- =============================================================================
-- Tables required by RODO Art. 5, 6, 7, 13–22, 28, 30, 32:
--   * audit_log — Art. 30 rejestr czynności (generic event log)
--   * consent_log — Art. 7 (audit of consent grants/withdrawals)
--   * dpa_signatures — Art. 28 (DPA agreements per klient)
--   * rodo_requests — Art. 15–22 (access, rectification, erasure, portability)
--   * breach_log — Art. 33 (incident notifications, 72h timer)
-- =============================================================================

-- Generic event log (Art. 30 rejestr czynności + ops audit)
CREATE TABLE audit_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at           TEXT NOT NULL DEFAULT (datetime('now')),
  actor                 TEXT NOT NULL,                          -- 'system' | 'admin:<email>' | 'client:<id>' | 'visitor' | 'va:<email>'
  actor_ip_hash         TEXT,                                   -- sha256(IP) — investigation aid
  action                TEXT NOT NULL,                          -- 'lead.created', 'consent.changed', 'client.activated', 'data.export', etc. (verb.noun)
  resource_type         TEXT,                                   -- 'lead', 'client', 'subscription', etc.
  resource_id           TEXT,
  client_id             TEXT REFERENCES clients(id) ON DELETE SET NULL,

  severity              TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
  metadata_json         TEXT
);

CREATE INDEX idx_audit_log_occurred ON audit_log(occurred_at DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor, occurred_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, occurred_at DESC);
CREATE INDEX idx_audit_log_client ON audit_log(client_id, occurred_at DESC) WHERE client_id IS NOT NULL;
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_severity ON audit_log(severity, occurred_at DESC) WHERE severity IN ('error', 'critical');

-- Consent audit (Art. 7 RODO — must demonstrate WHO consented WHEN to WHAT)
-- Each row is a single consent state change. Current state derived from latest entry.
CREATE TABLE consent_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  visitor_id_hash       TEXT NOT NULL,                          -- end-user identifier (NOT klient)
  occurred_at           TEXT NOT NULL DEFAULT (datetime('now')),

  -- Granular consent per Consent Mode v2 (4 signals + 2 baseline)
  ad_storage            TEXT NOT NULL CHECK (ad_storage IN ('granted', 'denied')),
  analytics_storage     TEXT NOT NULL CHECK (analytics_storage IN ('granted', 'denied')),
  ad_user_data          TEXT NOT NULL CHECK (ad_user_data IN ('granted', 'denied')),
  ad_personalization    TEXT NOT NULL CHECK (ad_personalization IN ('granted', 'denied')),
  functionality_storage TEXT NOT NULL DEFAULT 'granted',        -- always granted (essential)
  security_storage      TEXT NOT NULL DEFAULT 'granted',        -- always granted (security)

  -- Evidence
  consent_text_version  TEXT NOT NULL,                          -- 'v1.2' — which banner text was shown
  consent_text_hash     TEXT NOT NULL,                          -- sha256 of exact text shown
  source                TEXT NOT NULL CHECK (source IN ('banner', 'preferences_modal', 'api', 'inherited')),
  user_agent_family     TEXT,
  ip_country_code       TEXT,                                   -- coarse jurisdiction tracking

  -- Change tracking
  prior_consent_id      INTEGER REFERENCES consent_log(id),     -- chain to previous state
  was_explicit_action   INTEGER NOT NULL DEFAULT 1              -- BOOLEAN — user actively clicked (vs. inherited from default)
);

CREATE INDEX idx_consent_log_client_visitor ON consent_log(client_id, visitor_id_hash, occurred_at DESC);
CREATE INDEX idx_consent_log_occurred ON consent_log(occurred_at DESC);

-- DPA signatures (Art. 28 RODO — Data Processing Agreement per klient)
CREATE TABLE dpa_signatures (
  id                    TEXT PRIMARY KEY,                       -- 'dpa_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  dpa_template_version  TEXT NOT NULL,                          -- 'v1.2' — versioned templates after legal review
  dpa_pdf_r2_key        TEXT NOT NULL,                          -- signed PDF in R2
  dpa_pdf_hash          TEXT NOT NULL,                          -- sha256 — tamper evidence

  signed_by_name        TEXT NOT NULL,                          -- person who signed for klient
  signed_by_role        TEXT,                                   -- 'właściciel', 'prokurent', etc.
  signature_method      TEXT NOT NULL CHECK (signature_method IN (
                            'click_through', 'docusign', 'autenti', 'qualified_es', 'wet_signature'
                          )),
  signature_ip_hash     TEXT,
  signature_evidence_json TEXT,                                 -- DocuSign envelope ID, IP, timestamp chain

  effective_from        TEXT NOT NULL,
  effective_until       TEXT,                                   -- NULL if open-ended (until subscription cancellation)
  superseded_by         TEXT REFERENCES dpa_signatures(id),     -- new DPA signed (e.g. template updated)

  signed_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dpa_client ON dpa_signatures(client_id, effective_from DESC);
CREATE INDEX idx_dpa_active ON dpa_signatures(client_id) WHERE effective_until IS NULL;

-- RODO data subject requests (Art. 15 access, 16 rectification, 17 erasure, 20 portability, 21 objection)
CREATE TABLE rodo_requests (
  id                    TEXT PRIMARY KEY,                       -- 'rodoreq_<random>'

  -- Who is requesting
  requester_email_hash  TEXT NOT NULL,                          -- sha256, for dedup + lookup
  requester_phone_hash  TEXT,
  client_id             TEXT REFERENCES clients(id),            -- WHICH klient's data is concerned (visitor of THAT site)
  identity_verified     INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — did we verify identity (Art. 12.6)
  identity_verification_method TEXT,                            -- 'email_loop', 'phone_match', 'in_person'

  -- What they want
  request_type          TEXT NOT NULL CHECK (request_type IN (
                            'access',                            -- Art. 15
                            'rectification',                     -- Art. 16
                            'erasure',                           -- Art. 17 (right to be forgotten)
                            'restrict_processing',               -- Art. 18
                            'portability',                       -- Art. 20
                            'object',                            -- Art. 21
                            'withdraw_consent'                   -- Art. 7.3
                          )),
  request_text          TEXT,                                   -- original message from requester
  source                TEXT NOT NULL CHECK (source IN ('email', 'form', 'phone', 'letter', 'panel')),

  -- Processing (72h timer per Art. 12.3)
  received_at           TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at       TEXT,                                   -- klient confirmed receipt
  deadline_at           TEXT NOT NULL,                          -- received_at + 30 dni (extendable +60 with notification)
  resolved_at           TEXT,
  resolution            TEXT CHECK (resolution IN (
                            'fulfilled', 'partially_fulfilled', 'refused_no_data', 'refused_excessive', 'refused_unverified', 'forwarded_to_controller'
                          )),
  resolution_notes      TEXT,
  export_r2_key         TEXT,                                   -- if portability/access — ZIP w R2

  metadata_json         TEXT
);

CREATE INDEX idx_rodo_received ON rodo_requests(received_at DESC);
CREATE INDEX idx_rodo_open ON rodo_requests(deadline_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_rodo_requester ON rodo_requests(requester_email_hash);
CREATE INDEX idx_rodo_client ON rodo_requests(client_id, received_at DESC) WHERE client_id IS NOT NULL;

-- Breach incidents (Art. 33 — 72h notification to UODO, Art. 34 — notification to data subjects)
CREATE TABLE breach_log (
  id                    TEXT PRIMARY KEY,                       -- 'breach_<random>'

  detected_at           TEXT NOT NULL,
  occurred_at           TEXT,                                   -- when breach actually started (may be earlier)
  detected_by           TEXT NOT NULL,                          -- 'monitoring', 'admin', 'klient', 'data_subject', 'auditor'

  category              TEXT NOT NULL CHECK (category IN (
                            'confidentiality',                   -- unauthorized disclosure
                            'integrity',                         -- unauthorized alteration
                            'availability',                      -- accidental loss / destruction
                            'combination'
                          )),
  affected_clients_json TEXT NOT NULL DEFAULT '[]',             -- ["clk_a", "clk_b"]
  affected_records_count INTEGER,
  data_categories_json  TEXT NOT NULL,                          -- ["email", "phone", "name", "ip"]

  description           TEXT NOT NULL,
  root_cause            TEXT,
  containment_actions   TEXT,

  -- Notifications
  uodo_notified         INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN
  uodo_notified_at      TEXT,                                   -- must be < detected_at + 72h or justify in notes
  uodo_case_number      TEXT,

  data_subjects_notified INTEGER NOT NULL DEFAULT 0,
  data_subjects_notified_at TEXT,
  notification_method   TEXT,                                   -- 'email_individual', 'public_announcement', etc.

  severity              TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status                TEXT NOT NULL CHECK (status IN ('open', 'contained', 'resolved', 'closed_no_action')),
  resolved_at           TEXT,

  postmortem_url        TEXT,                                   -- link to runbooks/postmortems/...

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_breach_status ON breach_log(status, detected_at DESC) WHERE status != 'closed_no_action';
CREATE INDEX idx_breach_uodo_pending ON breach_log(detected_at) WHERE uodo_notified = 0 AND status = 'open';
