-- =============================================================================
-- 0002_billing.sql — Subscriptions + payments + invoices
-- =============================================================================
-- Stripe + Przelewy24 + Fakturownia integration.
-- Amounts stored in grosze (1/100 PLN) as INTEGER to avoid float rounding.
-- E.g. 29900 = 299.00 zł.
-- =============================================================================

CREATE TABLE subscriptions (
  id                    TEXT PRIMARY KEY,                       -- 'sub_<random>' internal ID
  client_id             TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN ('stripe', 'przelewy24')),
  external_id           TEXT NOT NULL,                          -- Stripe sub_xxx OR P24 sub identifier
  external_customer_id  TEXT,                                   -- Stripe cus_xxx; P24 hash

  -- Pricing
  monthly_amount_grosze INTEGER NOT NULL,                       -- e.g. 29900 = 299 zł
  setup_amount_grosze   INTEGER NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'PLN' CHECK (currency IN ('PLN', 'EUR', 'USD')),

  -- Plan
  tier                  TEXT NOT NULL CHECK (tier IN ('starter', 'standard', 'premium')),
  has_lock_in           INTEGER NOT NULL DEFAULT 0,             -- BOOLEAN
  lock_in_until         TEXT,                                   -- ISO date

  -- Lifecycle
  status                TEXT NOT NULL CHECK (status IN (
                            'incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused'
                          )),
  current_period_start  TEXT,
  current_period_end    TEXT,
  cancel_at             TEXT,                                   -- scheduled cancellation
  canceled_at           TEXT,                                   -- actual cancellation timestamp

  -- Add-ons (modules charged on top of tier)
  modules_json          TEXT NOT NULL DEFAULT '[]',             -- ['care', 'reputation', 'blog_ai', 'multi_location', 'geo']

  -- Audit
  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_subscriptions_provider_external ON subscriptions(provider, external_id);
CREATE INDEX idx_subscriptions_client ON subscriptions(client_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status IN ('active', 'trialing', 'past_due');
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end) WHERE status = 'active';

-- Individual payment events (audit + reconciliation)
CREATE TABLE payments (
  id                    TEXT PRIMARY KEY,                       -- 'pmt_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id),
  subscription_id       TEXT REFERENCES subscriptions(id) ON DELETE SET NULL,

  amount_grosze         INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'PLN',
  type                  TEXT NOT NULL CHECK (type IN (
                            'setup', 'monthly', 'annual', 'addon', 'one_time', 'refund', 'chargeback'
                          )),

  provider              TEXT NOT NULL CHECK (provider IN ('stripe', 'przelewy24')),
  external_id           TEXT NOT NULL,                          -- Stripe charge_xxx / pi_xxx OR P24 transaction ID

  status                TEXT NOT NULL CHECK (status IN (
                            'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'
                          )),
  failure_code          TEXT,
  failure_message       TEXT,

  paid_at               TEXT,
  refunded_at           TEXT,
  refund_amount_grosze  INTEGER,

  metadata_json         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_payments_provider_external ON payments(provider, external_id);
CREATE INDEX idx_payments_client_created ON payments(client_id, created_at DESC);
CREATE INDEX idx_payments_status_created ON payments(status, created_at DESC) WHERE status IN ('failed', 'refunded');
CREATE INDEX idx_payments_subscription ON payments(subscription_id) WHERE subscription_id IS NOT NULL;

-- VAT invoices (Fakturownia integration, JPK_V7 export)
CREATE TABLE invoices (
  id                    TEXT PRIMARY KEY,                       -- 'inv_<random>'
  client_id             TEXT NOT NULL REFERENCES clients(id),
  payment_id            TEXT REFERENCES payments(id) ON DELETE SET NULL,

  -- Fakturownia
  fakturownia_id        INTEGER UNIQUE,                         -- ID z Fakturownia.pl
  invoice_number        TEXT NOT NULL UNIQUE,                   -- "FV/2026/05/0001"
  invoice_date          TEXT NOT NULL,
  due_date              TEXT,
  paid_date             TEXT,

  net_grosze            INTEGER NOT NULL,
  vat_rate              REAL NOT NULL,                          -- 0.23 dla 23% VAT
  vat_grosze            INTEGER NOT NULL,
  gross_grosze          INTEGER NOT NULL,

  pdf_r2_key            TEXT,                                   -- R2 key to invoice PDF
  status                TEXT NOT NULL CHECK (status IN (
                            'draft', 'issued', 'sent', 'paid', 'overdue', 'canceled', 'corrected'
                          )),
  correction_invoice_id TEXT REFERENCES invoices(id),           -- if this is a correction note

  jpk_exported_at       TEXT,                                   -- when this invoice was included in JPK_V7 batch
  jpk_batch_id          TEXT,

  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoices_client_date ON invoices(client_id, invoice_date DESC);
CREATE INDEX idx_invoices_status ON invoices(status) WHERE status IN ('issued', 'sent', 'overdue');
CREATE INDEX idx_invoices_jpk_pending ON invoices(jpk_exported_at) WHERE jpk_exported_at IS NULL AND status = 'paid';
