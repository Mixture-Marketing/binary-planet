-- =============================================================================
-- 0003_leads.sql — Leady ze stron klientów (central D1, per-tenant namespace)
-- =============================================================================
-- All client sites POST leads to api.mixturemarketing.pl/api/leads — they land here.
-- Encrypted PII (name/email/phone) with per-tenant encryption key.
-- Default retention: 24 months (deleteable earlier via klient RODO request).
-- =============================================================================

CREATE TABLE leads (
  id                    TEXT PRIMARY KEY,                       -- 'lead_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Where it came from
  source                TEXT NOT NULL CHECK (source IN (
                            'contact_form', 'quote_form', 'phone_click', 'sms_click', 'whatsapp_click',
                            'email_click', 'gbp', 'chatbot', 'other'
                          )),
  source_page           TEXT,                                   -- URL path on client site, e.g. '/kontakt'
  campaign              TEXT,                                   -- if from UTM tracked landing
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,

  -- Anonymous visitor identification (hashed, RODO-friendly)
  visitor_id_hash       TEXT,                                   -- sha256(IP + UA + day-salt), rotates daily
  user_agent_family     TEXT,                                   -- 'Chrome', 'Safari' — not full UA
  country_code          TEXT,                                   -- 2-letter, CF-IPCountry header
  city                  TEXT,                                   -- coarse, CF-IPCity if available

  -- Lead payload (PII — encrypted at app layer)
  name_enc              TEXT,                                   -- PII (encrypted)
  email_enc             TEXT,                                   -- PII (encrypted)
  email_hash            TEXT,                                   -- sha256 for dedup + lookup
  phone_enc             TEXT,                                   -- PII (encrypted)
  phone_hash            TEXT,                                   -- sha256 for dedup
  message_enc           TEXT,                                   -- PII (encrypted)
  service_interest      TEXT,                                   -- non-PII: which service was selected (enum from client services)
  estimated_value_pln   INTEGER,                                -- if quote calculator used

  -- Consent (Art. 7 RODO + telecom rules)
  consent_processing    INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — required for lead processing
  consent_marketing     INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — separate marketing opt-in
  consent_text_version  TEXT,                                   -- which version of consent text was shown
  consent_ip_hash       TEXT,                                   -- evidence of consent
  consent_at            TEXT,

  -- Delivery (lead → klient)
  forwarded_to_client_at TEXT,                                  -- when email/SMS sent to klient
  forwarded_via         TEXT,                                   -- 'resend_email' / 'smsapi' / 'webhook'
  forwarded_status      TEXT CHECK (forwarded_status IN ('queued', 'sent', 'delivered', 'failed', 'bounced')),

  -- Status / handling
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'contacted', 'qualified', 'unqualified', 'won', 'lost', 'spam', 'duplicate'
                          )),
  is_hot                INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — flagged by scoring rules
  duplicate_of          TEXT REFERENCES leads(id),

  -- RODO retention
  delete_after          TEXT NOT NULL DEFAULT (date('now', '+24 months')),  -- ISO date
  deleted_at            TEXT,                                   -- when actually deleted (soft delete first)
  deletion_reason       TEXT,                                   -- 'retention', 'rodo_request', 'spam'

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leads_client_created ON leads(client_id, created_at DESC);
CREATE INDEX idx_leads_client_status ON leads(client_id, status) WHERE status NOT IN ('spam', 'duplicate');
CREATE INDEX idx_leads_email_hash ON leads(client_id, email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX idx_leads_phone_hash ON leads(client_id, phone_hash) WHERE phone_hash IS NOT NULL;
CREATE INDEX idx_leads_delete_after ON leads(delete_after) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_forwarded ON leads(forwarded_status, created_at) WHERE forwarded_status IN ('queued', 'failed');

-- Spoke fallback queue sync log (J.4 — gdy hub down, spoke buforuje, drain replay)
-- Tracks each replay attempt to detect chronic spoke→hub sync issues.
CREATE TABLE lead_replay_log (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  spoke_lead_id         TEXT NOT NULL,                          -- local KV key in spoke
  hub_lead_id           TEXT REFERENCES leads(id),              -- if successfully replayed
  attempt              INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL CHECK (status IN ('attempted', 'success', 'failed')),
  error                 TEXT,
  attempted_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_lead_replay_client ON lead_replay_log(client_id, attempted_at DESC);
CREATE INDEX idx_lead_replay_failed ON lead_replay_log(status, attempted_at DESC) WHERE status = 'failed';
