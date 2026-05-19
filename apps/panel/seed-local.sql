-- Local dev seed for mm-panel.
-- Adds client_contacts rows for clients seeded earlier by apps/admin/seed-local.sql.
-- Usage: pnpm exec wrangler d1 execute mm-control-plane --local --file seed-local.sql

INSERT OR REPLACE INTO client_contacts (
  client_id, contact_name, contact_email_enc, contact_email_hash, contact_phone_enc, contact_phone_hash
) VALUES
  ('clk_kowalski', 'Jan Kowalski',
   'dev:kontakt@kowalski-slusarz.pl',
   '45369542c4c9eeb6ec9882146146883add3eec5e68596f8d0589ae5c86787b6b',
   'dev:+48171234567', NULL),
  ('clk_nowak', 'Marek Nowak',
   'dev:nowak@nowak-auto.pl',
   'cf4e61150e210747aff78f2a8a8a2c2ecfa6af0461135d66c162ee6318aa86ca',
   NULL, NULL);
