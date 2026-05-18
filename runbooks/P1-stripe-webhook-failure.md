# P1: Stripe webhook failure

**Severity:** P1 — CRITICAL (revenue impact + provisioning broken)
**Response SLA:** 15 min
**Fix SLA:** 1h
**Last updated:** 2026-05-18

## Symptoms

- Stripe dashboard: Events → Webhook attempts → fail rate spike
- Email od Stripe: "Webhook endpoint is failing"
- Klient zapłacił ale strona nie deployuje się (provisioning workflow nie startuje)
- Subscription renewals failing → klient widzi "payment failed" mimo że karta OK
- D1 `payments` / `subscriptions` z desync vs Stripe

## Impact

- **🔴 Revenue impact**: zapłacone subskrypcje nie aktywują się → klient żąda zwrotu, churn
- **Onboarding broken**: nowy klient nie dostaje strony (sekwencja deploy nie startuje)
- **Compliance**: brak faktury w 7 dni (po opłacie) = naruszenie przepisów VAT
- **Stripe może wyłączyć endpoint** po 7 dniach pełnego fail rate

## Diagnostic commands

```bash
# 1. Sprawdź webhook health w Stripe dashboard
# Manualnie: dashboard.stripe.com → Developers → Webhooks → <endpoint URL>
# Zobacz: success rate last 24h, last 10 attempts z error responses

# 2. Sprawdź ostatnie webhooki w D1
wrangler d1 execute mm-control-plane --command \
  "SELECT stripe_event_id, event_type, status, processed_at, error FROM webhook_events WHERE source = 'stripe' ORDER BY created_at DESC LIMIT 20"

# 3. Sprawdź logi control plane
wrangler tail mm-control-plane --format pretty | grep -i "stripe\|webhook"

# 4. Test webhook endpoint manualnie (Stripe CLI)
# Wymaga: stripe-cli installed + STRIPE_SECRET_KEY (test mode)
stripe trigger checkout.session.completed --api-key sk_test_...

# 5. Sprawdź czy STRIPE_WEBHOOK_SECRET nie zerotowany
# Manualnie w Stripe dashboard: Webhooks → endpoint → Reveal signing secret
# Compare z wrangler secret w mm-control-plane (write-only, sprawdź tylko że SET)
```

## Resolution steps

### Scenario A — Signature verification failure (webhook secret mismatch)

```bash
# Najczęstsza przyczyna po rotacji secretu Stripe.

# 1. Pobierz aktualny webhook secret ze Stripe dashboard
# Manualnie: Webhooks → <endpoint> → Reveal signing secret

# 2. Update wrangler secret
echo "whsec_..." | wrangler secret put STRIPE_WEBHOOK_SECRET --env production --name mm-control-plane

# 3. Stripe replay failed events (last 7 days)
# Manualnie: dashboard → Webhooks → <endpoint> → Resend events (filtruj failed)
# Lub Stripe CLI:
stripe events resend <event_id> --account acct_...
```

### Scenario B — Endpoint returns 5xx (kod w control plane crashes)

```bash
# 1. Zobacz stack trace w wrangler tail
wrangler tail mm-control-plane --format pretty

# 2. Identify error w handlerze webhook
# Code path: mm-control-plane/src/routes/webhooks/stripe.ts

# 3. Hotfix → deploy
cd /path/to/mm-control-plane
# fix → commit → deploy
wrangler deploy --env production

# 4. Stripe replay failed events
```

### Scenario C — Idempotency issue (ten sam event processowany 2x)

```bash
# Stripe może retry. Jeśli code nie idempotentny, każda retry crashuje na UNIQUE constraint.

# 1. Sprawdź D1
wrangler d1 execute mm-control-plane --command \
  "SELECT stripe_event_id, COUNT(*) FROM webhook_events WHERE source = 'stripe' GROUP BY stripe_event_id HAVING COUNT(*) > 1"

# 2. Code fix: check `event.id` w `webhook_events` przed processem, zwracaj 200 jeśli już processed
# Lokalizacja: mm-control-plane/src/routes/webhooks/stripe.ts handler

# 3. Cleanup duplicates jeśli były
# UWAGA: tylko po fix code, inaczej re-trigger problem
```

### Scenario D — Provisioning workflow (Cloudflare Workflows) failing

```bash
# Webhook OK, ale workflow który deployuje stronę klienta nie kończy się.

# 1. Sprawdź CF Workflows dashboard
# Manualnie: dash.cloudflare.com → Workflows → <workflow ID dla provisioning>

# 2. Sprawdź gdzie utknął
# Steps: stripe_verify → github_create_repo → ai_generate_content → cf_create_worker → custom_hostname → notify_client

# 3. Manual retry step
# CF Workflows ma API: POST /accounts/.../workflows/.../instances/<id>/retry-from-step

# 4. Fallback manual provisioning
# Patrz: ops-onboard-new-client.md
```

### Scenario E — Klient widzi "payment failed" mimo że karta OK

```bash
# Renewal failing — 3D Secure challenge / karta wymaga dodatkowej autoryzacji.

# 1. Sprawdź w Stripe
# Manualnie: dashboard → Customers → <customer_id> → Subscriptions → latest invoice

# 2. Jeśli 3D Secure required:
# Wyślij klientowi link do panelu Stripe (Customer Portal) do retry
# TODO: po Faza 3 — direct link w naszym panelu klienta

# 3. Jeśli karta expired
# Email do klienta: "Proszę zaktualizować dane karty" + link do portalu
```

## Verification

```bash
# 1. Webhook fail rate w Stripe dashboard <5%
# (Najpierw replay failed events, potem czekaj 1h obserwując)

# 2. Test event przeprocessowany
stripe trigger checkout.session.completed --api-key sk_test_...
# Sprawdź w D1:
wrangler d1 execute mm-control-plane --command \
  "SELECT * FROM webhook_events WHERE source = 'stripe' ORDER BY created_at DESC LIMIT 1"
# Expected: status = 'processed'

# 3. Dla onboarding incident — sprawdź czy klient dostał stronę
# Manualnie: dashboard → Clients → <CLIENT_ID> → status = 'live'

# 4. Faktura wygenerowana w Fakturownia
# Manualnie: fakturownia.pl → Faktury → search by customer email
```

## Klient communication (tylko jeśli widoczne)

**Jeśli klient zapłacił ale provisioning broken:**
```
Temat: Twoja subskrypcja jest aktywna — strona wkrótce

Dzień dobry,

Płatność za [tier] zaksięgowana — bardzo dziękuję!

Mieliśmy chwilowy problem z naszym systemem deploy (Stripe webhook),
co opóźniło automatyczne utworzenie Pana strony. Już rozwiązane.

Strona [domena] będzie online w ciągu [X min].
Wyślę osobny email z linkiem do panelu administracyjnego.

Pozdrawiam,
Jakub
```

## Common causes

*(Pusta)*

## Postmortem

**Wymagany.** Dodatkowo: **audit log finansowy** — Stripe events które fail i co zostało disrupted (dla księgowej i potencjalnego audytu).
