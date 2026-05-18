-- =============================================================================
-- 0005_gbp_blog.sql — GBP review monitoring + AI blog drafts
-- =============================================================================
-- GBP reviews: daily cron pulls, AI suggests responses, Jakub batch-approves.
-- Blog drafts (Faza 7): monthly cron generates per Premium klient, PR opens.
-- =============================================================================

CREATE TABLE gbp_reviews (
  id                    TEXT PRIMARY KEY,                       -- GBP review name (Google's stable ID)
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  reviewer_name         TEXT,                                   -- per GBP API (Google shows display name)
  reviewer_profile_photo_url TEXT,
  star_rating           INTEGER NOT NULL CHECK (star_rating BETWEEN 1 AND 5),
  review_text           TEXT,                                   -- może być NULL (sama gwiazdka)
  review_lang           TEXT,                                   -- ISO 639-1 (Google detect)

  posted_at             TEXT NOT NULL,                          -- when reviewer posted
  fetched_at            TEXT NOT NULL DEFAULT (datetime('now')),

  -- Our response workflow
  response_text         TEXT,
  response_status       TEXT NOT NULL DEFAULT 'pending' CHECK (response_status IN (
                            'pending', 'ai_drafted', 'in_review', 'approved', 'posted', 'skipped', 'failed'
                          )),
  response_drafted_at   TEXT,
  response_drafted_by   TEXT,                                   -- 'ai' / 'admin:jakub'
  response_approved_by  TEXT,
  response_posted_at    TEXT,

  -- AI analysis
  sentiment             TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  sentiment_score       REAL,                                   -- -1.0 to 1.0
  topics_json           TEXT,                                   -- AI-extracted topics ['quality', 'price', 'speed']
  is_actionable         INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN — needs internal followup (negative review with specific complaint)

  -- Reputation impact tracking
  is_first_review_for_keyword INTEGER NOT NULL DEFAULT 0,       -- BOOLEAN — analytic flag

  metadata_json         TEXT
);

CREATE INDEX idx_gbp_reviews_client_posted ON gbp_reviews(client_id, posted_at DESC);
CREATE INDEX idx_gbp_reviews_response_pending ON gbp_reviews(client_id, response_status, posted_at DESC)
  WHERE response_status IN ('pending', 'ai_drafted', 'in_review');
CREATE INDEX idx_gbp_reviews_negative ON gbp_reviews(client_id, posted_at DESC) WHERE sentiment = 'negative';

-- Review request SMS tracking (Faza 5 — post-form-submit cron + SMSAPI)
CREATE TABLE review_requests (
  id                    TEXT PRIMARY KEY,                       -- 'rr_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  lead_id               TEXT REFERENCES leads(id),              -- source lead (post-purchase typically)

  channel               TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  recipient_hash        TEXT NOT NULL,                          -- sha256 of phone/email (privacy)
  sent_at               TEXT,
  delivered_at          TEXT,
  link_url              TEXT NOT NULL,                          -- short link clickable in SMS
  link_short_code       TEXT UNIQUE NOT NULL,                   -- 8-char slug

  clicked_at            TEXT,
  click_count           INTEGER NOT NULL DEFAULT 0,
  resulted_in_review_id TEXT REFERENCES gbp_reviews(id),        -- if traced back

  status                TEXT NOT NULL CHECK (status IN (
                            'queued', 'sent', 'delivered', 'clicked', 'completed', 'failed', 'spam'
                          )),

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_review_requests_client ON review_requests(client_id, created_at DESC);
CREATE INDEX idx_review_requests_short_code ON review_requests(link_short_code);

-- GBP posts (auto-posting cron — Faza 5)
CREATE TABLE gbp_posts (
  id                    TEXT PRIMARY KEY,                       -- 'gbpp_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gbp_external_id       TEXT,                                   -- post name from GBP API after posting

  post_type             TEXT NOT NULL CHECK (post_type IN ('update', 'offer', 'event')),
  title                 TEXT,
  body                  TEXT NOT NULL,
  cta_type              TEXT,                                   -- 'BOOK', 'CALL', 'LEARN_MORE', etc.
  cta_url               TEXT,
  image_r2_key          TEXT,                                   -- our copy in R2

  generated_by          TEXT NOT NULL CHECK (generated_by IN ('ai', 'admin', 'klient')),
  status                TEXT NOT NULL CHECK (status IN (
                            'draft', 'queued', 'posted', 'failed', 'expired'
                          )),

  scheduled_for         TEXT,
  posted_at             TEXT,
  expires_at            TEXT,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_gbp_posts_client_status ON gbp_posts(client_id, status, scheduled_for);
CREATE INDEX idx_gbp_posts_queue ON gbp_posts(scheduled_for) WHERE status = 'queued';

-- Blog drafts (AI content workflow, Faza 7 — Premium tier or add-on)
CREATE TABLE blog_drafts (
  id                    TEXT PRIMARY KEY,                       -- 'bd_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  topic                 TEXT NOT NULL,
  cluster               TEXT,                                   -- topic cluster (hub-and-spoke architecture)
  target_keyword        TEXT,                                   -- primary keyword for SEO
  related_keywords_json TEXT,                                   -- ["...", "..."]

  brief_md              TEXT NOT NULL,                          -- structured brief generated first
  draft_md              TEXT,                                   -- full draft

  word_count            INTEGER,
  reading_time_min      INTEGER,

  status                TEXT NOT NULL CHECK (status IN (
                            'brief_pending', 'brief_ready', 'draft_pending', 'draft_ready',
                            'in_review', 'approved', 'published', 'rejected', 'archived'
                          )),
  pr_url                TEXT,                                   -- GitHub PR opened against client repo
  published_url         TEXT,                                   -- live URL after merge + deploy

  generated_by          TEXT NOT NULL CHECK (generated_by IN ('ai', 'admin', 'klient')),
  model_used            TEXT,                                   -- 'claude-sonnet-4-6', etc.
  prompt_version        TEXT,                                   -- for tracking which prompt template
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  cost_grosze           INTEGER,                                -- in 1/100 grosza? actually keep as grosze

  reviewed_by           TEXT,
  reviewed_at           TEXT,
  review_notes          TEXT,
  rejection_reason      TEXT,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  published_at          TEXT
);

CREATE INDEX idx_blog_drafts_client_status ON blog_drafts(client_id, status);
CREATE INDEX idx_blog_drafts_review_queue ON blog_drafts(status, created_at)
  WHERE status IN ('brief_ready', 'draft_ready', 'in_review');
