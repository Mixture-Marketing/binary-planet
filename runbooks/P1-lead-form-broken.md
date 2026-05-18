# P1: Formularz kontaktowy nie zapisuje leadów

**Severity:** P1 — CRITICAL (data loss risk)
**Response SLA:** 15 min
**Fix SLA:** 1h
**Last updated:** 2026-05-18

## Symptoms

- Klient: "wypełniłem formularz na własnej stronie testowo, nic nie przyszło"
- Alert: `lead_form_error_rate > 5%` w ostatnich 10 min (Analytics Engine query)
- Hub D1 `leads` table — brak insertów dla `<CLIENT_ID>` w ciągu ostatnich Xh (anomalia vs baseline)
- Formularz zwraca 500 / 503 / timeout w przeglądarce
- Resend dashboard: drop emails dla `<CLIENT_DOMAIN>`
- Turnstile dashboard: spike `challenge_failed`

## Impact

- **🔴 NAJWYŻSZA PRIORYTET — DATA LOSS**: każdy nieprzeszły lead to potencjalna utrata kontraktu klienta
- **Revenue impact pośredni**: klient nie widzi leadów → zarzuca że "nic nie działa" → churn
- **RODO**: jeśli formularz przyjmuje dane ale nie zapisuje, NIE notify user → potencjalna skarga UODO

**FALLBACK QUEUE** (z planu J.4): spoke ma local KV queue. Sprawdź **najpierw czy leady są w queue** — wtedy nic nie stracone, tylko sync broken.

## Diagnostic commands

```bash
# 1. Sprawdź fallback queue w spoke
# TODO: po Faza 1
wrangler kv:key list --binding LEAD_QUEUE --env production --namespace-id <SPOKE_KV_ID>
# Każdy klucz = nieprzezsynchronizowany lead

# 2. Sprawdź ostatnie leady w hub D1
wrangler d1 execute mm-control-plane --command \
  "SELECT id, client_id, created_at, error FROM leads WHERE client_id = '<CLIENT_ID>' ORDER BY created_at DESC LIMIT 20"

# 3. Sprawdź spoke → hub błędy
wrangler tail mm-client-<CLIENT_ID> --format pretty | grep -i "lead\|form\|hub"

# 4. Test form endpoint manualnie
curl -v -X POST https://<CLIENT_DOMAIN>/api/contact \
  -H "Content-Type: application/json" \
  -H "Cf-Turnstile-Response: <TEST_TOKEN_BYPASS>" \
  -d '{"name":"diag","email":"diag@mixturemarketing.pl","message":"runbook test","consent":true}'

# 5. Sprawdź Turnstile (jeśli challenge failed)
# Manualnie: dash.cloudflare.com → Turnstile → sitekey dla klienta → analytics

# 6. Sprawdź Resend
# Manualnie: resend.com/emails → filter to=<email_klienta> last 1h
# Lub API:
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails?limit=20

# 7. Sprawdź rate limit KV (czy ktoś nie spamuje, blokując prawdziwe leady)
wrangler kv:key list --binding RATE_LIMIT --env production | grep <CLIENT_ID>
```

## Resolution steps

### Scenario A — Fallback queue ma leady, sync zepsute

```bash
# 1. Drain queue manualnie
# TODO: po Faza 1: skrypt drain-lead-queue.ts
# Pseudo: 
# for each key in LEAD_QUEUE:
#   POST do api.mixturemarketing.pl/api/leads
#   jeśli success, delete key
#   jeśli fail, retry exponential backoff

# 2. Naprawić root cause sync (zwykle: BP_CLIENT_API_KEY rotation went bad)
# Patrz Scenario C

# 3. Verify wszystkie leady są w hub D1
```

### Scenario B — Turnstile blokuje legitymate users

```bash
# 1. Sprawdź Turnstile threshold settings
# Manualnie: dash.cloudflare.com → Turnstile → <sitekey> → Settings
# Jeśli "Managed" za agresywne → przełącz na "Non-interactive"

# 2. Jeśli sitekey/secret mismatched (np. po rotacji)
# Sprawdź: spoke wrangler secret list
# vs Turnstile dashboard
# Jeśli mismatch: ponowna wrangler secret put

# 3. Hotfix temporary: feature flag w hub
wrangler d1 execute mm-control-plane --command \
  "UPDATE clients SET feature_flags = json_set(feature_flags, '$.turnstile_required', false) WHERE id = '<CLIENT_ID>'"
# UWAGA: tylko temporary, rate limit musi przejąć ochronę. Re-enable Turnstile ASAP.
```

### Scenario C — BP_CLIENT_API_KEY nie pasuje (auth fail spoke → hub)

```bash
# 1. Sprawdź klucz w spoke
# (Nie da się odczytać — wrangler secrets are write-only)
# Trzeba zrotować:

# 2. Wygeneruj nowy klucz
NEW_KEY="ck_live_$(openssl rand -hex 32)"
echo "NEW KEY: $NEW_KEY"

# 3. Update hub D1 (hashowany klucz)
NEW_HASH=$(echo -n "$NEW_KEY" | sha256sum | cut -d' ' -f1)
wrangler d1 execute mm-control-plane --command \
  "UPDATE clients SET api_key_hash = '$NEW_HASH', api_key_rotated_at = datetime('now') WHERE id = '<CLIENT_ID>'"

# 4. Update spoke secret
echo "$NEW_KEY" | wrangler secret put BP_CLIENT_API_KEY --name mm-client-<CLIENT_ID>

# 5. Verify form submission
```

### Scenario D — Resend bounce / rate limit

```bash
# 1. Sprawdź Resend status
curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains/<DOMAIN_ID>
# Verify "status": "verified"

# 2. Jeśli DKIM broken po DNS change
# Manualnie: resend.com → Domains → re-verify

# 3. Jeśli rate limit
# Resend free: 100 emails/dzień. Jeśli klient ma spike, upgrade plan
# Lub temporary: zmień provider na SMSAPI email (mają tę usługę)

# 4. Jeśli klient email bouncuje (spam folder)
# Sprawdź SPF/DMARC dla mixturemarketing.pl
# Sprawdź czy adresat nie ma whitelisty
```

### Scenario E — Validation error (klient zmienił required fields w form)

```bash
# 1. Sprawdź repo klienta — ostatni commit
gh repos/mixturemarketing/mm-client-<CLIENT_ID>/commits --limit 5

# 2. Jeśli zmiana w form schema
# Revert albo dostosuj walidację w spoke handler
```

## Verification

```bash
# 1. Test E2E form submission z prawdziwego browsera
# Manualnie: open https://<CLIENT_DOMAIN>/kontakt → fill form → submit → expect "dziękujemy"

# 2. Sprawdź lead w D1 control plane
wrangler d1 execute mm-control-plane --command \
  "SELECT * FROM leads WHERE client_id = '<CLIENT_ID>' ORDER BY created_at DESC LIMIT 1"

# 3. Sprawdź email dostarczony do klienta
# Resend dashboard: status "delivered"

# 4. Sprawdź queue empty
wrangler kv:key list --binding LEAD_QUEUE --env production --namespace-id <SPOKE_KV_ID>
# Expected: pusta lub tylko in-flight

# 5. Synthetic test cron pickup w następnym cyklu
```

## Klient communication

**Po fix:**
```
Temat: Formularz kontaktowy przywrócony

Dzień dobry,

Naprawiłem problem z formularzem na [domena].
W okresie [start]–[end] formularz [nie wysyłał emaili / nie zapisywał leadów].

Status leadów:
- W kolejce zapisowej (fallback): X leadów — wysłałem do Pana mailem teraz
- Utraconych: 0 (mamy queue który chronił dane)

Co się stało: [opis przyjazny].
Co poprawione: [opis].

Pozdrawiam,
Jakub
```

## Common causes

*(Pusta — wypełniamy po pierwszych incydentach)*

## Postmortem

**Wymagany.** Dodatkowo: **raport RODO** w wewnętrznym rejestrze przetwarzania (Art. 30) — incident dotyczący danych osobowych musi być udokumentowany, nawet jeśli nie ma breach (klauzula 72h notification dotyczy tylko breach, ale audit log zawsze).
