-- =============================================================================
-- 0015_newsletter.sql — Newsletter + SMS Automation addon (Track 24f-4)
-- =============================================================================

CREATE TABLE newsletter_subscribers (
  id              TEXT PRIMARY KEY,
  client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email_hash      TEXT NOT NULL,
  email_enc       TEXT NOT NULL,
  phone_hash      TEXT,
  phone_enc       TEXT,
  name            TEXT,
  source          TEXT NOT NULL DEFAULT 'widget',
  -- double opt-in flow
  confirm_token   TEXT,
  confirmed_at    TEXT,
  opt_out_at      TEXT,
  opt_out_reason  TEXT,
  tags_json       TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(client_id, email_hash)
);

CREATE INDEX idx_newsletter_subscribers_client ON newsletter_subscribers(client_id, confirmed_at)
  WHERE opt_out_at IS NULL;
CREATE INDEX idx_newsletter_subscribers_confirm ON newsletter_subscribers(confirm_token)
  WHERE confirm_token IS NOT NULL;

CREATE TABLE newsletter_campaigns (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel          TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject          TEXT NOT NULL,
  body_markdown    TEXT NOT NULL,
  sms_body         TEXT,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at     TEXT,
  sent_at          TEXT,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  delivered_count  INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT
);

CREATE INDEX idx_newsletter_campaigns_client ON newsletter_campaigns(client_id, status, scheduled_at);

CREATE TABLE newsletter_sends (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id     TEXT NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
  subscriber_id   TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  status          TEXT NOT NULL CHECK (status IN ('sent','delivered','failed','bounced')),
  external_id     TEXT,
  error_message   TEXT,
  sent_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_newsletter_sends_campaign ON newsletter_sends(campaign_id, status);
