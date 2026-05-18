# APPENDIX E — D1 Database Schemas + Billing Flow

## E.1 `binary-planet-control-plane` — D1 schema (główna DB)

```sql
-- Klienci agencji
CREATE TABLE clients (
  id TEXT PRIMARY KEY,                      -- client-slug, np. 'slusarz-kowalski-rzeszow'
  business_name TEXT NOT NULL,
  legal_name TEXT,
  nip TEXT UNIQUE,
  regon TEXT,
  primary_domain TEXT,
  industry TEXT NOT NULL,                   -- 'locksmith', 'notary', etc.
  theme_preset TEXT NOT NULL,               -- 'craftsman', 'professional', etc.
  city TEXT NOT NULL,
  postal_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',    -- 'active', 'suspended', 'churned', 'pending'
  tier TEXT NOT NULL,                       -- 'starter', 'standard', 'premium'
  has_lock_in BOOLEAN NOT NULL,
  lock_in_until TEXT,                       -- ISO date, jeśli lock-in 12 mc
  signed_dpa_at TEXT,                       -- ISO timestamp
  signed_dpa_pdf_url TEXT,                  -- R2 URL
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  github_repo_url TEXT,
  cf_worker_name TEXT,
  notes TEXT
);

-- Subskrypcja billing
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,                   -- 'stripe' | 'przelewy24'
  external_id TEXT NOT NULL,                -- Stripe sub_xxx lub P24 transaction
  monthly_amount_pln INTEGER NOT NULL,      -- in grosze (29900 = 299 zł)
  setup_amount_pln INTEGER DEFAULT 0,
  status TEXT NOT NULL,                     -- 'trialing', 'active', 'past_due', 'canceled'
  current_period_end TEXT,
  cancel_at TEXT,
  modules_json TEXT NOT NULL,               -- JSON list of enabled modules ['care', 'local_pro', 'reputation']
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Płatności (audit log)
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  subscription_id TEXT REFERENCES subscriptions(id),
  amount_pln INTEGER NOT NULL,
  type TEXT NOT NULL,                       -- 'setup', 'monthly', 'addon', 'refund'
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leady ze wszystkich stron klientów (per-tenant namespace)
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  source TEXT NOT NULL,                     -- 'contact-form', 'phone-click', 'sms', 'gbp'
  visitor_id TEXT,                          -- hash IP+UA, dla RODO
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  service_interest TEXT,
  user_consent_marketing BOOLEAN DEFAULT 0,
  forwarded_to_client_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delete_after TEXT                         -- retention: 24 mc default
);

-- SEO metryki snapshoty (cron miesięczny)
CREATE TABLE seo_metrics (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  snapshot_date TEXT NOT NULL,
  gsc_clicks INTEGER,
  gsc_impressions INTEGER,
  gsc_ctr REAL,
  gsc_avg_position REAL,
  ga4_sessions INTEGER,
  ga4_users INTEGER,
  ga4_conversions INTEGER,
  gbp_views INTEGER,
  gbp_calls INTEGER,
  gbp_directions INTEGER,
  gbp_photo_views INTEGER,
  lighthouse_perf REAL,
  lighthouse_a11y REAL,
  lighthouse_seo REAL,
  lighthouse_bp REAL,
  cwv_lcp_ms INTEGER,
  cwv_inp_ms INTEGER,
  cwv_cls REAL,
  uptime_pct REAL,
  metadata_json TEXT
);

-- Lokalne keyword rankings (DataForSEO)
CREATE TABLE keyword_rankings (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  keyword TEXT NOT NULL,
  location TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  position INTEGER,
  in_local_pack BOOLEAN,
  in_ai_overview BOOLEAN,
  url TEXT,
  metadata_json TEXT
);

-- Citation submissions
CREATE TABLE citations (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  directory TEXT NOT NULL,                  -- 'pkt.pl', 'panoramafirm', etc.
  status TEXT NOT NULL,                     -- 'pending', 'submitted', 'verified', 'live', 'failed'
  submitted_at TEXT,
  verified_at TEXT,
  listing_url TEXT,
  screenshot_r2_url TEXT,
  metadata_json TEXT
);

-- GBP reviews aggregator
CREATE TABLE gbp_reviews (
  id TEXT PRIMARY KEY,                      -- GBP review id
  client_id TEXT NOT NULL REFERENCES clients(id),
  reviewer_name TEXT,
  star_rating INTEGER NOT NULL,
  review_text TEXT,
  posted_at TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  response_text TEXT,                       -- nasza odpowiedź
  response_status TEXT,                     -- 'pending', 'ai_drafted', 'approved', 'posted'
  response_drafted_at TEXT,
  response_posted_at TEXT,
  sentiment TEXT                            -- 'positive', 'neutral', 'negative'
);

-- Drafty bloga (AI workflow)
CREATE TABLE blog_drafts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES clients(id),
  topic TEXT NOT NULL,
  cluster TEXT,
  brief_md TEXT NOT NULL,
  draft_md TEXT,
  status TEXT NOT NULL,                     -- 'brief_ready', 'draft_ready', 'in_review', 'approved', 'published', 'rejected'
  pr_url TEXT,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  metadata_json TEXT
);

-- Health monitor
CREATE TABLE health_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT NOT NULL REFERENCES clients(id),
  checked_at TEXT NOT NULL,
  http_status INTEGER,
  response_time_ms INTEGER,
  ssl_valid BOOLEAN,
  ssl_expires_at TEXT,
  cwv_lcp_ms INTEGER,
  uptime BOOLEAN NOT NULL
);

-- Audit log (RODO requirement)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,                      -- 'system', 'admin:jakub', 'client:xxx', 'visitor'
  action TEXT NOT NULL,                     -- 'lead_created', 'lead_deleted', 'consent_changed', 'data_export'
  resource_type TEXT,
  resource_id TEXT,
  client_id TEXT,
  metadata_json TEXT
);

CREATE INDEX idx_leads_client_created ON leads(client_id, created_at DESC);
CREATE INDEX idx_leads_delete_after ON leads(delete_after);
CREATE INDEX idx_seo_metrics_client_date ON seo_metrics(client_id, snapshot_date DESC);
CREATE INDEX idx_keyword_rankings_client_date ON keyword_rankings(client_id, snapshot_date DESC);
CREATE INDEX idx_gbp_reviews_client_status ON gbp_reviews(client_id, response_status);
```

## E.2 Per-client D1 (opcjonalny, jeśli klient potrzebuje własnej DB)

Tylko dla Premium tier z modułem CMS-dynamic albo specjalnymi wymaganiami. Schema minimum:

```sql
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  source TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Większość klientów: leady idą do **centralnej D1 control plane** (per-tenant namespace), klient nie ma własnej D1.

## E.3 Billing Flow (Stripe + Przelewy24)

**Setup w fazie 0:**
1. Stripe — utworzenie produktów: `tier_starter_lockin`, `tier_starter_nolockin`, `tier_standard_lockin`, `tier_standard_nolockin`, `tier_premium_lockin`, `tier_premium_nolockin`, `setup_starter`, `setup_standard`, `setup_premium`, `addon_multi_location`, `addon_geo`, `addon_extra_blog_post`
2. Przelewy24 — utworzenie analogicznych produktów + endpoint webhook
3. Webhook secrets w wrangler secrets (NIE w environment vars)

**Flow przy nowym kliencie (Krok 11 wizardu):**

```
1. Frontend wizard: POST /api/checkout/init
   Body: { tier, lockIn, addons, clientData }
   Response: { provider: 'stripe'|'przelewy24', checkoutUrl }

2. Backend (control-plane Worker):
   a. Insert do clients (status='pending')
   b. Insert do subscriptions (status='trialing')
   c. Stripe: create Checkout Session lub P24: create transaction
   d. Save external_id w subscriptions
   e. Return checkout URL

3. Klient płaci (Stripe/P24)

4. Webhook callback POST /api/webhooks/[provider]
   a. Verify webhook signature
   b. Update subscriptions.status='active', payments insert
   c. Update clients.status='active', signed_dpa_at=now()
   d. Enqueue provisioning workflow (Cloudflare Queue → Workflow)

5. Provisioning Workflow (Cloudflare Workflows):
   Step 1: GitHub API — create repo z template
   Step 2: GitHub API — write client.config.ts + initial content
   Step 3: Anthropic API — generate copy from wizard inputs
   Step 4: GitHub API — commit AI content
   Step 5: CF API — create Worker for this client
   Step 6: CF API — bind D1/KV/R2 (if needed by modules)
   Step 7: CF for SaaS API — create Custom Hostname
   Step 8: GitHub Actions trigger — first deploy
   Step 9: Poll Custom Hostname status (every 30s, max 1h)
   Step 10: Email client (Resend) — DNS instructions + CMS login + dashboard access
   Step 11: Notify Jakub (email/Slack) — new client, queue 15-min review

6. Po review:
   a. Jakub klika "Approved" w dashboard
   b. Status clients.status='active' confirmed
   c. Email do klienta: "Wszystko gotowe!"
```

**Cancellation flow:**
- Klient w panelu klikuje "Anuluj subskrypcję"
- Walidacja: jeśli lock-in nieskończony, pokaż "Możesz anulować po {lock_in_until}, ewentualnie skontaktuj się z nami"
- Jeśli OK: Stripe/P24 API — cancel at period end
- subscriptions.cancel_at = period_end
- Po dacie: cron downgrade'uje stronę do read-only (Worker zwraca strona-archive), data export ready (eksport contentu Sveltia → ZIP do R2)

---
