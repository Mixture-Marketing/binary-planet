-- =============================================================================
-- 0011_addons.sql — Addon modules (Track 24)
-- =============================================================================
-- Catalog of optional addons that clients can activate on top of their base
-- package (Starter/Standard/Premium/Professional). Each addon = separate Stripe
-- subscription line item OR one-time charge.
--
-- Architecture:
--   addon_modules  — read-only catalog (what's available, prices, descriptions)
--   client_addons  — assignment table (which client has which addon active)
--
-- Lifecycle:
--   trial    → klient activated with 7-14 day free trial
--   active   → billing flowing through Stripe
--   paused   → klient paused (we don't bill, klient sees grace state)
--   canceled → klient deactivated; row kept for audit
-- =============================================================================

CREATE TABLE addon_modules (
  slug                  TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL CHECK (category IN (
                            'marketing_seo',
                            'design_ux',
                            'ai_automation',
                            'sales_conversion',
                            'security_analytics',
                            'one_time'
                          )),
  short_description     TEXT NOT NULL,
  long_description      TEXT,
  benefit_line          TEXT NOT NULL,
  price_grosze          INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'PLN',
  billing_period        TEXT NOT NULL CHECK (billing_period IN ('monthly', 'one_time')),
  stripe_price_id       TEXT,
  trial_days            INTEGER NOT NULL DEFAULT 0,
  recommended_for_json  TEXT NOT NULL DEFAULT '[]',
  required_addons_json  TEXT NOT NULL DEFAULT '[]',
  required_tier         TEXT CHECK (required_tier IN ('starter', 'standard', 'premium', 'professional')),
  exclusive_with_json   TEXT NOT NULL DEFAULT '[]',
  is_active             INTEGER NOT NULL DEFAULT 1,
  display_order         INTEGER NOT NULL DEFAULT 100,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_addon_modules_category ON addon_modules(category, display_order) WHERE is_active = 1;

CREATE TABLE client_addons (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id                   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  addon_slug                  TEXT NOT NULL REFERENCES addon_modules(slug) ON DELETE RESTRICT,
  status                      TEXT NOT NULL CHECK (status IN ('trial', 'active', 'paused', 'canceled')),
  activated_at                TEXT NOT NULL DEFAULT (datetime('now')),
  trial_until                 TEXT,
  canceled_at                 TEXT,
  cancel_reason               TEXT,
  stripe_subscription_item_id TEXT,
  stripe_invoice_id           TEXT,
  price_grosze_at_activation  INTEGER NOT NULL,
  metadata_json               TEXT NOT NULL DEFAULT '{}',
  UNIQUE(client_id, addon_slug, activated_at)
);

CREATE INDEX idx_client_addons_active ON client_addons(client_id, status) WHERE status IN ('trial', 'active');
CREATE INDEX idx_client_addons_billing ON client_addons(stripe_subscription_item_id) WHERE stripe_subscription_item_id IS NOT NULL;

-- =============================================================================
-- Addon bundles — bundle deals like "Pełna konwersja" (3 addons at 25% off)
-- =============================================================================
CREATE TABLE addon_bundles (
  slug                  TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  description           TEXT NOT NULL,
  addon_slugs_json      TEXT NOT NULL,
  bundle_price_grosze   INTEGER NOT NULL,
  recommended_for_json  TEXT NOT NULL DEFAULT '[]',
  display_order         INTEGER NOT NULL DEFAULT 100,
  is_active             INTEGER NOT NULL DEFAULT 1
);

-- =============================================================================
-- Seed: initial addon catalog (Track 24 v1)
-- =============================================================================

-- ============== MARKETING / SEO ==============================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('geo_llm_pro', 'GEO/LLM PRO',
    'marketing_seo',
    'Optymalizacja pod ChatGPT, Perplexity, Gemini.',
    'Twoja firma cytowana przez AI gdy klient pyta o lokalne usługi.',
    2000, 'monthly',
    '["lawyer","accountant","dentist","physiotherapist"]', 10),

  ('competitor_monitoring', 'Monitoring konkurencji',
    'marketing_seo',
    'Cotygodniowy raport pozycji 3 konkurentów na Twoje frazy.',
    'Wiesz dokładnie czy wygrywasz, czy tracisz na SEO.',
    3000, 'monthly',
    '["lawyer","dentist","beauty","auto_repair"]', 20),

  ('blog_ai', 'Blog AI',
    'marketing_seo',
    '2 posty/miesiąc auto-generowane przez Claude, ty akceptujesz.',
    'Stała aktywność na blogu bez czasu na pisanie.',
    3900, 'monthly',
    '["lawyer","accountant","physiotherapist","dentist"]', 30);

-- ============== DESIGN / UX ==================================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('instagram_sync', 'Instagram auto-sync',
    'design_ux',
    'Twoje IG-rolki i zdjęcia automatycznie na stronie.',
    'Stała świeżość bez podwójnej pracy.',
    2500, 'monthly',
    '["beauty","hairdresser","restaurant","fitness_trainer","barber"]', 40),

  ('fomo_counter', 'FOMO licznik',
    'design_ux',
    '"47 osób skorzystało w tym tygodniu" widget na stronie.',
    'Klient widzi że inni już wybrali — chętniej dzwoni.',
    2500, 'monthly',
    '["barber","beauty","auto_repair","locksmith"]', 50);

-- ============== AI / AUTOMATION ==============================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('chatbot_basic', 'Chatbot AI Basic',
    'ai_automation',
    'Llama 3.1 8B (open-source) — 500 wiadomości/mc.',
    'Odpowiada na pytania klientów 24/7, zbiera leady.',
    3000, 'monthly',
    '["accountant","lawyer","dentist","physiotherapist","auto_repair"]', 60),

  ('chatbot_pro', 'Chatbot AI PRO',
    'ai_automation',
    'Llama 3.3 70B + 2000 wiadomości/mc.',
    'Lepsza jakość odpowiedzi i większy ruch.',
    6000, 'monthly',
    '["lawyer","dentist","accountant"]', 70),

  ('chatbot_premium', 'Chatbot AI Premium',
    'ai_automation',
    'Claude Haiku, unlimited wiadomości.',
    'Najwyższa jakość, polski natywnie.',
    9000, 'monthly',
    '["lawyer","dentist"]', 80),

  ('reviews_pro', 'Zarządzanie opiniami PRO',
    'ai_automation',
    'AI generuje draft odpowiedzi na każdą opinię, Ty akceptujesz.',
    'Lepsza reputacja w 5 minut/mc zamiast godziny.',
    4000, 'monthly',
    '["restaurant","beauty","auto_repair","dentist","hairdresser","barber"]', 90),

  ('newsletter_sms', 'Newsletter + SMS Automation',
    'ai_automation',
    'Subskrypcja + miesięczne kampanie SMS/email do bazy.',
    'Powracający klienci bez wysiłku.',
    5000, 'monthly',
    '["beauty","hairdresser","restaurant","fitness_trainer","barber"]', 100);

-- ============== SALES / CONVERSION ===========================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('leadpop_discount', 'Leadpop z rabatem',
    'sales_conversion',
    'Popup "Zostaw email, dostań -10% na pierwszą wizytę".',
    'Buduje bazę kontaktów i konwertuje odwiedzających.',
    2000, 'monthly',
    '["beauty","hairdresser","barber","fitness_trainer","auto_repair"]', 110),

  ('call_tracking', 'Call tracking',
    'sales_conversion',
    'Zlicza telefony ze strony i z Google Mapy.',
    'Wiesz ile telefonów dziennie generuje strona.',
    3000, 'monthly',
    '["locksmith","auto_repair","plumber","electrician","carpenter","roofer"]', 120);

-- ============== SECURITY / ANALYTICS =========================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('backup_pro', 'Backup PRO',
    'security_analytics',
    'Backup co 6h + 30-dniowa retencja + szyfrowanie.',
    'Spokojny sen — możesz odzyskać dowolny dzień miesiąca.',
    3000, 'monthly',
    '["lawyer","accountant","dentist","physiotherapist"]', 130),

  ('analytics_pro', 'Analityka PRO',
    'security_analytics',
    'Dashboard Looker Studio + miesięczny raport PDF.',
    'Widzisz dokładnie skąd przychodzą klienci i co działa.',
    3000, 'monthly',
    '["lawyer","accountant","dentist","fitness_trainer"]', 140);

-- ============== ONE-TIME =====================================================
INSERT INTO addon_modules (slug, name, category, short_description, benefit_line, price_grosze, billing_period, recommended_for_json, display_order)
VALUES
  ('nfc_stand', 'NFC stojak "Zbliż i oceń"',
    'one_time',
    'Fizyczny stojak na ladę — klient zbliża telefon i ocenia.',
    'Drastycznie więcej opinii Google bez proszenia.',
    9900, 'one_time',
    '["restaurant","barber","beauty","hairdresser","cafe","auto_repair"]', 200),

  ('booking_integration', 'Integracja systemu rezerwacji',
    'one_time',
    'Wbudowany widget Booksy/Calendly/Bookero na stronie.',
    'Klient rezerwuje wizytę bez wychodzenia ze strony.',
    14900, 'one_time',
    '["beauty","hairdresser","barber","dentist","physiotherapist","fitness_trainer"]', 210),

  ('language_addon', 'Dodatkowa wersja językowa',
    'one_time',
    'EN/UA/DE z profesjonalnym tłumaczeniem AI + weryfikacja.',
    'Dotrzesz do turystów i klientów zagranicznych.',
    19900, 'one_time',
    '["restaurant","cafe","lawyer","accountant","dentist"]', 220),

  ('extra_subpage', 'Dodatkowa podstrona Premium',
    'one_time',
    'Nowa zoptymalizowana podstrona z copywritingem + SEO.',
    'Rozszerz ofertę o niszową usługę z dedykowaną stroną.',
    15000, 'one_time',
    '[]', 230),

  ('site_migration', 'Migracja istniejącej strony',
    'one_time',
    'Przeniesiemy treść, SEO, redirecty z Twojej starej strony.',
    'Brak utraty pozycji w Google podczas zmiany.',
    29900, 'one_time',
    '[]', 240),

  ('wolt_glovo', 'Wolt/Glovo integracja',
    'one_time',
    'Widget zamówień Wolt/Glovo/Pyszne wbudowany na stronie.',
    'Większa sprzedaż delivery bez przekierowywania.',
    19900, 'one_time',
    '["restaurant","cafe"]', 250),

  ('seasonal_photo', 'Sesja foto sezonowa',
    'one_time',
    'Profesjonalna sesja zdjęciowa 1×/rok (jedzenie, portfolio, salon).',
    'Świeże zdjęcia wysokiej jakości na stronę i social.',
    59900, 'one_time',
    '["restaurant","beauty","hairdresser","barber"]', 260);

-- ============== BUNDLES ======================================================
INSERT INTO addon_bundles (slug, name, description, addon_slugs_json, bundle_price_grosze, recommended_for_json, display_order)
VALUES
  ('bundle_conversion', 'Pełna konwersja',
    'Wszystko co zamienia odwiedzającego w klienta: popup z rabatem, FOMO licznik i tracking telefonów.',
    '["leadpop_discount","fomo_counter","call_tracking"]',
    7500,
    '["barber","beauty","hairdresser","auto_repair"]', 10),

  ('bundle_visual_brand', 'Visual Brand',
    'Stała aktywność visual: Instagram auto-sync, blog AI i newsletter z opiniami.',
    '["instagram_sync","blog_ai","newsletter_sms"]',
    9900,
    '["beauty","hairdresser","fitness_trainer","restaurant"]', 20),

  ('bundle_pro_local', 'PRO Local',
    'Maksymalna widoczność lokalna: monitoring konkurencji, opinie PRO i analityka PRO.',
    '["competitor_monitoring","reviews_pro","analytics_pro"]',
    8500,
    '["restaurant","beauty","auto_repair","dentist"]', 30),

  ('bundle_ai_full', 'AI Suite',
    'Wszystko AI: chatbot PRO, blog AI, opinie PRO.',
    '["chatbot_pro","blog_ai","reviews_pro"]',
    11900,
    '["lawyer","accountant","dentist"]', 40);
