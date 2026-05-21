-- =============================================================================
-- 0017_delivery_nfc.sql — Track 24f-6 + 24f-7
-- Wolt/Glovo (one-time) + NFC stojak (one-time): per-klient config
-- =============================================================================

CREATE TABLE delivery_config (
  client_id     TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  delivery_url  TEXT NOT NULL,
  provider      TEXT NOT NULL DEFAULT 'generic' CHECK (provider IN ('wolt', 'glovo', 'pyszne', 'uber_eats', 'generic')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE nfc_config (
  client_id        TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  google_place_id  TEXT NOT NULL,
  -- Logistics: dropshipping order tracking (one-time NFC sticker shipment)
  shipping_status  TEXT NOT NULL DEFAULT 'pending' CHECK (shipping_status IN ('pending','ordered','shipped','delivered')),
  shipping_address TEXT,
  ordered_at       TEXT,
  shipped_at       TEXT,
  delivered_at     TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
