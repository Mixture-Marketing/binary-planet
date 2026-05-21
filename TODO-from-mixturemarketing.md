# Status integracji `mixturemarketing.pl/abonament` ↔ `binary-planet hub`

> Update: **2026-05-19**. Marketing landing live.
> Endpoint `POST /api/admin/preonboard` zaimplementowany (binary-planet commit `466c61d`).

---

## ✅ Już zrobione po stronie mixturemarketing.pl

- ✅ Marketing landing `/abonament/` — deployed live
- ✅ Modal preonboard z formularzem (4 pola + 2 consenty)
- ✅ Walidacja klient-side: NIP (10 cyfr), email regex, **phone E.164 strict** (`/^\+\d{8,15}$/`)
- ✅ Header **`X-BP-Preonboard-Key`** (NIE `X-BP-Admin-Key`)
- ✅ Body z **wszystkimi wymaganymi polami** kontrakt v1.0:
  - `business_name`, `email`, `phone`, `nip`, `tier`
  - `consent_processing: true` (RODO Art. 6 — UI checkbox required)
  - `consent_marketing: bool` (opcjonalny checkbox)
  - `consent_text_version: "v1.0"`
- ✅ Parsing response: `data.client_id` z `already_exists` flagą
- ✅ Error handling per code: `VALIDATION_ERROR` (422), `RATE_LIMITED` (429), `AUTH_*` (401/403), NIP collision (500 z 'nip' w message → friendly UX "NIP już zarejestrowany")
- ✅ Stripe Checkout flow: POST `/api/admin/stripe/checkout` z `success_path` + `cancel_path`
- ✅ Success page `/abonament/dziekujemy/` (noindex)
- ✅ Cancel handler `/abonament/?stripe=canceled` z banner
- ✅ JSON-LD Service schema z 3 Offer per tier + FAQ + SpeakableSpecification
- ✅ Nav: Footer link + Home 4th service card + MegaMenu callout (emerald gradient)
- ✅ Env slot `VITE_MM_PREONBOARD_KEY` w `.env.local` + `.env.example`

---

## ⏸ CZEKAM na Jakuba

### 1. `PREONBOARD_PUBLIC_KEY` — wartość secret

Wygeneruj:
```bash
openssl rand -base64 32
```

Wstaw w **2 miejsca**:

**a) binary-planet (CF Worker):**
```bash
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler secret put PREONBOARD_PUBLIC_KEY
# wklej wartość
```

**b) mixturemarketing.pl (CF Pages env):**
```bash
# Cloudflare Pages dashboard → mixturemarketing-stona → Settings → Environment variables
VITE_MM_PREONBOARD_KEY=<ta_sama_wartosc>
# Albo lokalnie:
echo "VITE_MM_PREONBOARD_KEY=<wartosc>" >> D:\KOD\Mixture\MixtureMarketing-stona\.env.local
```

**Po wstawieniu:** rebuild + redeploy mixturemarketing.pl (env var inline'owany przy build przez Vite).

### 2. CORS na hub'ie (binary-planet)

Endpoint `api.mixturemarketing.pl` musi pozwolić origin `https://mixturemarketing.pl`:

```ts
// W CF Worker handle CORS preflight
response.headers.set('Access-Control-Allow-Origin', 'https://mixturemarketing.pl')
response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-BP-Preonboard-Key')
response.headers.set('Access-Control-Max-Age', '86400')

// Opcjonalnie dla preview:
// Origin: 'https://*.mixturemarketing-stona.pages.dev' (CF Pages preview deploys)
```

**Verify:** po deploy hub'a sprawdź w devtools:
```bash
curl -i -X OPTIONS https://api.mixturemarketing.pl/api/admin/preonboard \
  -H "Origin: https://mixturemarketing.pl" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,X-BP-Preonboard-Key"
# Oczekiwane: HTTP 204 z odpowiednimi Access-Control-* headers
```

---

## 🧪 Test E2E po wstawieniu klucza

1. Otwórz https://mixturemarketing.pl/abonament/ w incognito
2. Klik **"Wybierz Standard"** (środkowa karta — najpopularniejszy)
3. Wypełnij formularz testowymi danymi:
   - Nazwa: `Test Sklep Sp. z o.o.`
   - Email: `test+e2e@mixturemarketing.pl`
   - Telefon: `+48600100200`
   - NIP: `1234567890`
   - ☑ Zgoda RODO
4. Klik **"Zapłać 199 zł kartą"**
5. Powinno przekierować na `checkout.stripe.com` (test mode)
6. Karta testowa: `4242 4242 4242 4242`, CVV: `123`, data: dowolna przyszła
7. Po success: redirect na `/abonament/dziekujemy/?sid=cs_test_...`
8. Verify w hub'ie:
   ```bash
   # Po stripe webhook hit, client status powinien zmienić się na 'provisioning'
   curl https://api.mixturemarketing.pl/api/health
   # I w admin panel:
   open https://app.mixturemarketing.pl/clients
   ```

### Test cases krawędziowe (UX errors)

- **NIP collision:** wyślij ten sam NIP 2x z różnych emaili → 2. próba powinna pokazać "Ten NIP jest już zarejestrowany"
- **Rate limit:** 6 zgłoszeń w godzinę z jednego IP → 6. powinno pokazać "Za dużo prób w krótkim czasie. Spróbuj ponownie za godzinę."
- **E.164:** wpisz `600100200` (bez +) → walidacja klient-side pokaże "Telefon musi być w formacie międzynarodowym..."
- **Bez RODO:** odznacz `consent_processing` → klient-side pokaże "Aby kontynuować, musisz wyrazić zgodę..."
- **Idempotent:** kliknij submit 2x z tym samym emailem (pending) → drugi call zwróci ten sam client_id z `already_exists: true`, modal poleci dalej do Stripe normalnie

---

## 📝 Notatka o headerze checkout

Modal wysyła `X-BP-Preonboard-Key` także do `POST /api/admin/stripe/checkout` (forward-compatible).
Aktualnie endpoint checkout nie weryfikuje tego header'a — Jakub może w przyszłości włączyć weryfikację bez zmiany kodu w mixturemarketing.pl.

---

## ⚠️ FEEDBACK z E2E testów 2026-05-19

**Rate limit 5/h per IP jest za agresywny.** Podczas integracji testowej (Mixture stronę):
- Mixture agent zrobił 3-4 test calls przez curl + puppeteer
- Jakub spróbował 1× w przeglądarce — dostał 429 "Za dużo prób"
- Total ~5 prób z dwóch (potencjalnie tej samej) sieci → bucket pełny

Realny scenariusz produkcyjny: klient ma literówkę w NIP, próbuje 2-3 razy. Klient na zmiennym IP firmowym może odpadać normalnie.

**Rekomendacja:**
- Podnieść preonboard rate limit z **5/h → 10-15/h** per IP
- Lub dodać exponential backoff zamiast hard limit
- Lub osobny wyższy limit dla CORS-origin'd requests z `mixturemarketing.pl` (real klient) vs server-to-server bez Origin (potencjalny bot)

**Reset manualny (dla testów):**
```bash
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler kv key list --binding=<RATE_LIMIT_KV_BINDING> --remote | grep preonboard
pnpm exec wrangler kv key delete "rate_limit:preonboard:<IP>" --binding=<...> --remote
```

---

## 🚀 Faza 2 (po launchu — nice-to-have)

- [ ] Support dla `referral_code` w preonboard payload (gdy dojdzie program partnerski Faza 5 L.4)
- [ ] Real-time provisioning status — endpoint `GET /api/admin/clients/:id/status` żeby success page mógł pokazać live update "Twoja strona jest w provisioning... 70%"
- [ ] Cancel webhook (Stripe `customer.subscription.deleted`) → odpiąć custom domain klienta

---

**Kontakt:** Jakub Mixture · info@mixturemarketing.pl
**Repo MM:** `D:\KOD\Mixture\MixtureMarketing-stona` · branch `main` · live deploy
**Modal v1.0 kontrakt:** zgodny z binary-planet commit `466c61d`
