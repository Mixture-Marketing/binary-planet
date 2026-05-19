-- Local dev seed for mm-admin.
-- Usage: pnpm exec wrangler d1 execute mm-control-plane --local --file seed-local.sql

INSERT OR REPLACE INTO admin_users (id, email, display_name, role, status)
VALUES ('usr_jakub', 'info@mixturemarketing.pl', 'Jakub', 'admin', 'active');

INSERT OR REPLACE INTO clients (
  id, business_name, legal_name, nip, regon, industry, subtype_schema, theme_preset,
  city, tier, status, primary_domain, feature_flags_json, modules_json, activated_at, notes
) VALUES
  ('clk_kowalski', 'Ślusarz Kowalski', 'Kowalski Jan — Usługi Ślusarskie',
   '8121234567', '123456789', 'locksmith', 'Locksmith', 'craftsman',
   'Rzeszów', 'starter', 'active', 'kowalski-slusarz.pl',
   '{"ai_blog_enabled":false}', '["care"]', datetime('now','-90 days'),
   'Pilotowy klient — demo Track I2'),
  ('clk_nowak', 'Auto-mechanik Nowak', NULL,
   NULL, NULL, 'mechanic', 'AutoRepair', 'craftsman',
   'Kraków', 'standard', 'active', 'nowak-auto.pl',
   '{}', '["care","seo"]', datetime('now','-45 days'),
   NULL),
  ('clk_wojciechowski', 'Salon Beauty Anna', NULL,
   NULL, NULL, 'beauty', 'BeautySalon', 'beauty',
   'Warszawa', 'premium', 'pending', NULL,
   '{}', '[]', NULL,
   'Czeka na opłatę pierwszej faktury'),
  ('clk_paused', 'Stolarz Test', NULL,
   NULL, NULL, 'carpenter', 'GeneralContractor', 'craftsman',
   'Wrocław', 'starter', 'paused', 'stolarz-test.pl',
   '{}', '[]', datetime('now','-200 days'),
   'Pauza — klient na urlopie do września');

-- Sample leads spread across last 7 days
INSERT INTO leads (id, client_id, source, status, is_hot, email_hash, phone_hash, service_interest, estimated_value_pln, created_at)
VALUES
  ('lead_1', 'clk_kowalski', 'contact_form', 'new',      1, 'h1a', 'p1a', 'awaryjne-otwieranie-zamkow', 200, datetime('now','-15 minutes')),
  ('lead_2', 'clk_kowalski', 'phone_click',  'contacted',1, 'h2a', NULL,  NULL, NULL, datetime('now','-2 hours')),
  ('lead_3', 'clk_kowalski', 'contact_form', 'qualified',0, 'h3a', NULL,  'wymiana-zamkow', 600, datetime('now','-1 day')),
  ('lead_4', 'clk_nowak',    'contact_form', 'new',      0, 'h4a', NULL,  'wymiana-oleju', 250, datetime('now','-3 hours')),
  ('lead_5', 'clk_nowak',    'phone_click',  'won',      0, 'h5a', NULL,  NULL, 1800, datetime('now','-2 days')),
  ('lead_6', 'clk_nowak',    'contact_form', 'unqualified', 0, 'h6a', NULL, 'diagnostyka', NULL, datetime('now','-4 days')),
  ('lead_7', 'clk_kowalski', 'contact_form', 'spam',     0, 'h7a', NULL,  NULL, NULL, datetime('now','-5 days'));

-- Sample alerts
INSERT INTO alerts (id, severity, alert_type, client_id, title, description, status, runbook_url, fired_at)
VALUES
  ('alt_1', 'P1', 'site_offline', 'clk_kowalski',
   'Strona kowalski-slusarz.pl nie odpowiada',
   'Health check z 3 lokalizacji zwrócił 5xx przez ostatnie 6 minut. Dotyczy klienta clk_kowalski.',
   'open',
   'https://github.com/MixtureMarketing/binary-planet/blob/main/runbooks/P1-site-offline.md',
   datetime('now','-12 minutes')),
  ('alt_2', 'P2', 'ssl_expiring', 'clk_nowak',
   'SSL cert nowak-auto.pl wygasa za 13 dni',
   'Certyfikat dla nowak-auto.pl wygasa 2026-06-01. Cloudflare powinien automatycznie odnowić — sprawdź czy DNS records są poprawne.',
   'acked',
   'https://github.com/MixtureMarketing/binary-planet/blob/main/runbooks/P2-ssl-expiring.md',
   datetime('now','-3 hours')),
  ('alt_3', 'P3', 'gbp_sync_lag', 'clk_kowalski',
   'GBP sync opóźniony o 4h',
   'Ostatnia synchronizacja Google Business Profile była 4h temu zamiast standardowych <30min.',
   'open',
   NULL,
   datetime('now','-1 hour'));

-- Sample ai_calls + health_checks + cron_runs for /operations page
INSERT INTO ai_calls (client_id, caller, provider, model, input_tokens, output_tokens, cost_grosze, latency_ms, occurred_at)
VALUES
  ('clk_kowalski', 'blog_draft',  'anthropic', 'claude-opus-4-7',   2400, 800, 29, 4200, datetime('now','-2 hours')),
  ('clk_nowak',    'lead_score',  'anthropic', 'claude-sonnet-4-6', 1500, 500,  7, 1800, datetime('now','-5 hours')),
  ('clk_kowalski', 'meta_gen',    'anthropic', 'claude-haiku-4-5',   800, 200,  1,  600, datetime('now','-1 day'));

INSERT INTO health_checks (client_id, checked_at, http_status, response_time_ms, uptime)
VALUES
  ('clk_kowalski', datetime('now','-3 minutes'),  200,  145, 1),
  ('clk_nowak',    datetime('now','-3 minutes'),  200,  220, 1),
  ('clk_kowalski', datetime('now','-12 minutes'), 503, 8000, 0);

INSERT INTO cron_runs (job_name, started_at, finished_at, status, duration_ms, items_processed, error)
VALUES
  ('health-check',        datetime('now','-3 minutes'),  datetime('now','-2 minutes'),  'success',  1240, 4, NULL),
  ('gsc-daily-pull',      datetime('now','-7 hours'),    datetime('now','-7 hours'),    'success',  3500, 4, NULL),
  ('backup-daily',        datetime('now','-1 day'),      datetime('now','-1 day'),      'success',  9100, 1, NULL),
  ('dataforseo-weekly',   datetime('now','-2 days'),     datetime('now','-2 days'),     'failed',  12000, 0, 'DataForSEO rate limit hit'),
  ('daily-digest',        datetime('now','-2 hours'),    datetime('now','-2 hours'),    'success',   800, 1, NULL);
