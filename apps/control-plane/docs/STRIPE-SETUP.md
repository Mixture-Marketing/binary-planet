# Stripe API setup — Track 6 (subscriptions + invoicing)

## 1. Konto Stripe

1. Zarejestruj konto biznesowe: **https://dashboard.stripe.com/register** (PL — wybierz "Poland")
2. Wypełnij onboarding (dane firmy MM, NIP, konto bankowe do payout, dokument tożsamości)
3. Czekasz na verification — zwykle <24h dla PL
4. Po verification: `details_submitted=true`, `charges_enabled=true` (sprawdza je verify CLI)

## 2. Test vs Live

Stripe ma 2 oddzielne tryby. Klucze różnią się prefixem:
- **Test:** `sk_test_…` — fake karty, fake pieniądze, do dev
- **Live:** `sk_live_…` — prawdziwe karty i pieniądze, do produkcji

Zaczynamy od **test** żeby nic nie zepsuć. Live tylko po pełnym E2E.

## 3. Wygeneruj API key (test mode)

Dashboard → **Developers → API keys** → Reveal "Secret key" → **`sk_test_…`**

Skopiuj do `.dev.vars`:
```
STRIPE_SECRET_KEY="sk_test_..."
```

## 4. Utwórz 3 produkty (jeden per tier)

Dashboard → **Products → Add product**:

| Tier | Name | Price | Billing |
|------|------|-------|---------|
| starter | "MM Starter" | **149.00 PLN** | Recurring · Monthly |
| standard | "MM Standard" | **199.00 PLN** | Recurring · Monthly |
| premium | "MM Premium" | **299.00 PLN** | Recurring · Monthly |

Po stworzeniu każdego produktu Stripe wyświetla **Price ID** (`price_xxx`). Skopiuj wszystkie 3 do `.dev.vars`:

```
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_STANDARD="price_..."
STRIPE_PRICE_PREMIUM="price_..."
```

Tip: nazwij ceny "Tier-A: starter", "Tier-B: standard", "Tier-C: premium" — łatwiej zarządzasz w dashboard.

## 5. Webhook endpoint

Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL** (dev — używaj **Stripe CLI** żeby forward'ować do localhost — patrz § 7):
  - **Production:** `https://api.mixturemarketing.pl/api/webhooks/stripe`

- **Listen to:** Wybierz events:
  ```
  checkout.session.completed
  customer.subscription.created
  customer.subscription.updated
  customer.subscription.deleted
  invoice.paid
  invoice.payment_succeeded
  invoice.payment_failed
  charge.refunded
  ```

- Po zapisie kliknij endpoint → **Signing secret** → Reveal → **`whsec_…`**

```
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## 6. Sprawdź lokalnie

```powershell
cd D:\KOD\binary-planet\apps\control-plane
node --env-file=.dev.vars scripts/verify-stripe.mjs
```

Oczekiwany output:
```
Stripe credentials check — mode TEST

  GET /v1/account (key auth) ... OK (acct_xxx · PL · MixtureMarketing)
  Account onboarding complete ... OK (charges enabled)
  Price starter (price_xxx) ... OK (149.00 PLN/mc)
  Price standard (price_xxx) ... OK (199.00 PLN/mc)
  Price premium (price_xxx) ... OK (299.00 PLN/mc)
  STRIPE_WEBHOOK_SECRET ... OK (format whsec_…)

ALL CHECKS PASSED
```

## 7. Test webhooków lokalnie — Stripe CLI

```powershell
# Install Stripe CLI: https://docs.stripe.com/stripe-cli (winget install Stripe.StripeCLI)
stripe login

# Forward webhooks to your local control-plane (port 8787):
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler dev --port 8787
# In a NEW terminal:
stripe listen --forward-to localhost:8787/api/webhooks/stripe

# Stripe CLI wyświetli "Ready! Your webhook signing secret is whsec_..."
# Wstaw ten signing secret jako STRIPE_WEBHOOK_SECRET dla local dev
# (różny od signing secret produkcyjnego endpointa!)
```

Wywołaj testowy event:
```powershell
stripe trigger checkout.session.completed
```

W terminalu hub'a zobaczysz event przyjęty, audit_log + (dla eventów z `metadata.client_id`) status klienta flipnie na `provisioning`.

## 8. Production secrety

Po E2E w test mode + uzyskaniu live keys:
```powershell
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler secret put STRIPE_SECRET_KEY      # sk_live_...
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET  # whsec_... (z prod endpointa!)
pnpm exec wrangler secret put STRIPE_PRICE_STARTER   # price_... (LIVE mode price IDs są inne niż test!)
pnpm exec wrangler secret put STRIPE_PRICE_STANDARD
pnpm exec wrangler secret put STRIPE_PRICE_PREMIUM
pnpm exec wrangler secret put STRIPE_CHECKOUT_RETURN_URL  # https://app.mixturemarketing.pl
```

**Ważne:** Live mode ma **osobne** Price IDs — musisz utworzyć produkty drugi raz po włączeniu live mode w dashboard (Test ⇆ Live toggle w lewym górnym rogu).

## 9. Flow w produkcji

1. **Klient** wypełnia onboarding wizard w mm-admin → submit
2. Admin tworzy `clients` row ze statusem `pending`
3. Admin POST `/api/admin/stripe/checkout` z `{ client_id, tier, customer_email }`
4. Hub zwraca `{ url: "https://checkout.stripe.com/..." }`
5. Admin redirectuje przeglądarkę usera (klienta) na ten URL
6. Klient wypełnia kartę w Stripe Checkout
7. Stripe POST webhook `checkout.session.completed` → hub flipuje `clients.status='provisioning'`
8. Cron `provision_pending` (Track 4) odpala provisioning workflow → OVH + GitHub + CF deploy → status `active`
9. Stripe co miesiąc auto-pobiera płatność → webhook `invoice.paid` → hub zapisuje payment
10. Cron `monthly_reports` → Fakturownia generuje fakturę (Track 7)

## 10. Failure modes

| Stripe webhook | Reakcja hub'a | Reakcja klienta |
|----------------|---------------|------------------|
| `checkout.session.completed` (no client_id) | Audit `missing_client_id` warning | Brak (sytuacja patologiczna — webhook bez metadata) |
| `customer.subscription.updated` (status=past_due) | Klient `status='active'` (grace period) | Email "płatność nie przeszła, spróbuj ponownie" |
| `customer.subscription.updated` (status=unpaid) | Klient `status='suspended'` | Strona dalej działa, ale w panelu komunikat |
| `customer.subscription.deleted` | Klient `status='churned'` | Strona przestaje być pod custom domain (CF custom domain remove — Track 4-prod) |
| `invoice.payment_failed` | Audit log warning + `payments.status='failed'` | Stripe Smart Retry (3 próby w 3 tygodnie) + email od MM |
| `charge.refunded` | Audit log + manual reconciliation | Stripe auto-refunds, klient widzi w panelu jako `payments.status='refunded'` |

## 11. Rotacja kluczy

Jeśli `sk_test_…` lub `sk_live_…` wyciekł:
1. Dashboard → Developers → API keys → **Roll** secret key
2. Stripe wyświetli nowy klucz, stary momentalnie disabled
3. `pnpm exec wrangler secret put STRIPE_SECRET_KEY` z nowym kluczem
4. `wrangler deploy` (Worker pobierze nowy secret przy następnym uruchomieniu)

## 12. Stripe Tax (na razie WYŁĄCZONE)

W kodzie ustawione `automatic_tax: { enabled: false }`. Klient MM jest płatnikiem VAT 23% i fakturę VAT generujemy przez **Fakturownia.pl** (Track 7), nie przez Stripe Tax. Stripe Tax można włączyć później jeśli chcesz korzystać z ich VAT compliance — wymaga PL VAT registration uploaded do Stripe.
