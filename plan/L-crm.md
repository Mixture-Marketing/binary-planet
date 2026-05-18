# APPENDIX L — CRM / Sales Pipeline

## L.1 Problem

Bez CRM tracimy 60–70% leadów własnej agencji:
- Klient wpadł na wizard, abandoned na kroku 8 → tracimy
- Klient wypełnił form "Skontaktuj się" na binary-planet.pl → nie ma gdzie zapisać
- Klient po demo nie odpowiedział → nie ma reminder flow

## L.2 Architektura

**D1 schema dodać do control plane:**

```sql
CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,                   -- 'wizard_abandoned', 'contact_form', 'referral', 'cold_outbound', 'event'
  status TEXT NOT NULL,                   -- 'new', 'qualified', 'demo_scheduled', 'demo_done', 'proposal_sent', 'won', 'lost', 'nurturing'
  business_name TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  industry TEXT,
  city TEXT,
  estimated_tier TEXT,                    -- 'starter', 'standard', 'premium', 'business'
  wizard_session_id TEXT,                 -- jeśli abandoned mid-wizard, link do zapisanej sesji do recovery
  wizard_completion_pct INTEGER,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer_client_id TEXT REFERENCES clients(id),  -- jeśli z affiliate
  first_contact_at TEXT,
  last_contact_at TEXT,
  next_followup_at TEXT,
  notes TEXT,
  lost_reason TEXT,
  converted_to_client_id TEXT REFERENCES clients(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE prospect_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                     -- 'email_sent', 'email_opened', 'email_clicked', 'demo_call', 'sms_sent', 'note'
  direction TEXT,                         -- 'outbound', 'inbound'
  subject TEXT,
  body TEXT,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE email_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                     -- 'wizard_abandoned_24h', 'demo_followup_3d', 'newsletter_monthly'
  trigger TEXT NOT NULL,                  -- 'wizard_abandoned', 'manual', 'cron'
  delay_hours INTEGER,
  template_id TEXT NOT NULL,
  status TEXT NOT NULL                    -- 'active', 'paused'
);

CREATE TABLE email_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id TEXT REFERENCES prospects(id),
  client_id TEXT REFERENCES clients(id),
  campaign_id TEXT REFERENCES email_campaigns(id),
  resend_id TEXT,                         -- Resend message ID for tracking
  status TEXT NOT NULL,                   -- 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
  sent_at TEXT,
  opened_at TEXT,
  clicked_at TEXT
);
```

## L.3 Drip email campaigns (przez Resend + cron)

**Wizard abandoned recovery (target: 30-50% recovery rate):**
- T+1h: "Hej, zauważyliśmy że zacząłeś tworzyć stronę dla {businessName}. Możesz dokończyć tu: {wizard_resume_link}"
- T+24h: "Twoja strona jest 60% gotowa — zostań przy nas, dokończmy w 5 min"
- T+72h: "Jeśli masz pytania, odpowiedz na ten email — pomożemy"
- T+7d: "Jednorazowo: 50 zł zniżki na pierwszy miesiąc, jeśli dokończysz w 48h: {link}"

**Demo scheduled flow:**
- T-24h przed demo: reminder z linkiem do Calendly + agenda
- T+3d po demo bez decyzji: "Czy masz pytania po naszej rozmowie?"
- T+7d: case study klienta z podobnej branży
- T+14d: ostatni follow-up + offer demo z technikiem

**Post-conversion onboarding (gdy klient został aktywowany):**
- Day 1: welcome + login do Sveltia + DPA do podpisu
- Day 7: "Twoja strona w cyfrach — pierwsze 7 dni" (analytics email)
- Day 30: month 1 report + next steps
- Day 90: review call propozycja

## L.4 Affiliate / referral program (jeśli wdrażamy)

W `clients` dodać:
- `referral_code TEXT UNIQUE` — generowany dla każdego klienta po onboardingu
- `referred_by TEXT REFERENCES clients(id)` — jeśli ten klient przyszedł z polecenia

Reward: 1 mc free dla obu (referrer i referred) po pierwszej successful płatności referred.

Dashboard widget per klient: "Twój kod polecający: ABC123. Polecaj i miesiąc gratis."

---
