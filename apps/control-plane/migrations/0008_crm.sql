-- =============================================================================
-- 0008_crm.sql — CRM / Sales Pipeline (Appendix L)
-- =============================================================================
-- Pre-conversion: prospects (cold outreach + wizard abandoned + inbound).
-- Post-conversion: prospect linked to client via converted_to_client_id.
-- Drip campaigns + email tracking (Resend webhooks → email_sends).
-- =============================================================================

CREATE TABLE prospects (
  id                    TEXT PRIMARY KEY,                       -- 'prsp_<random>'

  -- Lead source
  source                TEXT NOT NULL CHECK (source IN (
                            'wizard_abandoned', 'contact_form', 'cold_call', 'cold_email',
                            'referral', 'partnership', 'event', 'inbound_organic',
                            'inbound_paid', 'social', 'other'
                          )),
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,
  utm_content           TEXT,
  referrer_client_id    TEXT REFERENCES clients(id) ON DELETE SET NULL,
  referrer_partner      TEXT,                                   -- 'biuro_rachunkowe_ABC', 'izba_gospodarcza_rzeszow'

  -- Identification
  business_name         TEXT,
  contact_name          TEXT,                                   -- PII (not encrypted at this stage — pre-conversion lower risk)
  contact_email_hash    TEXT,                                   -- sha256 for dedup
  contact_email_enc     TEXT,                                   -- PII (encrypted)
  contact_phone_hash    TEXT,
  contact_phone_enc     TEXT,                                   -- PII (encrypted)
  industry              TEXT,
  city                  TEXT,
  voivodeship           TEXT,
  estimated_tier        TEXT CHECK (estimated_tier IN ('starter', 'standard', 'premium', 'business', 'unknown')),

  -- Wizard recovery (if abandoned)
  wizard_session_id     TEXT,
  wizard_step_reached   INTEGER,                                -- 1–12
  wizard_completion_pct INTEGER CHECK (wizard_completion_pct BETWEEN 0 AND 100),
  wizard_data_json      TEXT,                                   -- snapshot for resume

  -- Pipeline state
  status                TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'attempted_contact', 'qualified', 'demo_scheduled', 'demo_done',
                            'proposal_sent', 'negotiating', 'won', 'lost', 'nurturing', 'unresponsive', 'do_not_contact'
                          )),
  qualification_score   INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
  is_hot                INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN

  -- Conversion
  converted_to_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  converted_at          TEXT,
  lost_reason           TEXT,                                   -- 'price', 'competitor', 'no_response', 'unqualified', 'budget', 'timing'
  lost_competitor       TEXT,

  -- Lifecycle dates
  first_contact_at      TEXT,
  last_contact_at       TEXT,
  last_response_at      TEXT,                                   -- when THEY responded (not just we emailed)
  next_followup_at      TEXT,

  notes                 TEXT,
  assigned_to           TEXT,                                   -- 'admin:jakub', 'va:<email>' (Faza 8)

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prospects_status ON prospects(status, next_followup_at) WHERE status NOT IN ('won', 'lost', 'do_not_contact');
CREATE INDEX idx_prospects_source ON prospects(source, created_at DESC);
CREATE INDEX idx_prospects_email_hash ON prospects(contact_email_hash) WHERE contact_email_hash IS NOT NULL;
CREATE INDEX idx_prospects_phone_hash ON prospects(contact_phone_hash) WHERE contact_phone_hash IS NOT NULL;
CREATE INDEX idx_prospects_assigned ON prospects(assigned_to, status) WHERE status NOT IN ('won', 'lost');
CREATE INDEX idx_prospects_followup ON prospects(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_prospects_wizard_resume ON prospects(wizard_session_id) WHERE wizard_session_id IS NOT NULL;

-- Per-prospect interaction log (every touch — call, email, demo, note)
CREATE TABLE prospect_interactions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id           TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

  type                  TEXT NOT NULL CHECK (type IN (
                            'email_sent', 'email_opened', 'email_clicked', 'email_replied', 'email_bounced',
                            'call_outbound', 'call_inbound', 'call_voicemail',
                            'sms_sent', 'sms_replied',
                            'demo_scheduled', 'demo_completed', 'demo_no_show',
                            'meeting', 'note', 'status_change', 'wizard_step_completed'
                          )),
  direction             TEXT CHECK (direction IN ('outbound', 'inbound', 'system')),

  subject               TEXT,
  body                  TEXT,
  duration_seconds      INTEGER,                                -- for calls
  outcome               TEXT,                                   -- 'interested', 'not_interested', 'callback_requested', 'voicemail'

  initiated_by          TEXT,                                   -- 'admin:jakub', 'system', 'prospect'
  metadata_json         TEXT,

  occurred_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_prospect_interactions_prospect_time ON prospect_interactions(prospect_id, occurred_at DESC);
CREATE INDEX idx_prospect_interactions_type_time ON prospect_interactions(type, occurred_at DESC);

-- Email campaigns (drip + manual broadcast)
CREATE TABLE email_campaigns (
  id                    TEXT PRIMARY KEY,                       -- 'cmp_<slug>'
  name                  TEXT NOT NULL,                          -- 'wizard_abandoned_24h', 'demo_followup_3d', 'newsletter_monthly_klienci'
  description           TEXT,

  trigger               TEXT NOT NULL CHECK (trigger IN (
                            'wizard_abandoned', 'demo_scheduled', 'demo_done_no_decision',
                            'prospect_status_change', 'client_activated', 'client_day_7', 'client_day_30', 'client_day_90',
                            'manual', 'cron_weekly', 'cron_monthly'
                          )),
  audience              TEXT NOT NULL CHECK (audience IN ('prospects', 'clients', 'both')),
  delay_hours           INTEGER,                                -- delay after trigger

  template_id           TEXT NOT NULL,                          -- Resend template ID
  subject               TEXT NOT NULL,
  preview_text          TEXT,

  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  total_sent            INTEGER NOT NULL DEFAULT 0,
  total_opened          INTEGER NOT NULL DEFAULT 0,
  total_clicked         INTEGER NOT NULL DEFAULT 0,
  total_replied         INTEGER NOT NULL DEFAULT 0,
  total_converted       INTEGER NOT NULL DEFAULT 0,             -- actions counted as conversion

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_email_campaigns_status ON email_campaigns(status, trigger);

-- Email sends (per-recipient, tracks Resend lifecycle)
CREATE TABLE email_sends (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id           TEXT REFERENCES prospects(id) ON DELETE CASCADE,
  client_id             TEXT REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id           TEXT REFERENCES email_campaigns(id),

  recipient_email_hash  TEXT NOT NULL,                          -- sha256 for dedup
  resend_id             TEXT UNIQUE,                            -- Resend's message ID for webhook correlation

  status                TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
                            'queued', 'sent', 'delivered', 'opened', 'clicked', 'replied',
                            'bounced', 'complained', 'failed', 'unsubscribed'
                          )),

  queued_at             TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at               TEXT,
  delivered_at          TEXT,
  opened_at             TEXT,
  open_count            INTEGER NOT NULL DEFAULT 0,
  clicked_at            TEXT,
  click_count           INTEGER NOT NULL DEFAULT 0,
  replied_at            TEXT,
  bounced_at            TEXT,
  bounce_type           TEXT,                                   -- 'hard', 'soft', 'complaint'

  unsubscribe_token     TEXT UNIQUE,                            -- for one-click unsubscribe per CAN-SPAM
  unsubscribed_at       TEXT,

  metadata_json         TEXT
);

CREATE INDEX idx_email_sends_prospect ON email_sends(prospect_id, queued_at DESC) WHERE prospect_id IS NOT NULL;
CREATE INDEX idx_email_sends_client ON email_sends(client_id, queued_at DESC) WHERE client_id IS NOT NULL;
CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id, status);
CREATE INDEX idx_email_sends_status ON email_sends(status, queued_at) WHERE status IN ('queued', 'failed');
CREATE INDEX idx_email_sends_recipient ON email_sends(recipient_email_hash, status);
CREATE INDEX idx_email_sends_unsubscribe_token ON email_sends(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;
