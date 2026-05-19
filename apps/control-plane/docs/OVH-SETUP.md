# OVH API setup — Track 4 production provisioning

To zarejestrujesz token raz, używasz wszędzie. Token ma 3 wartości — wszystkie idą do Worker secrets.

## 1. Zaloguj się i wygeneruj credentials

Otwórz: **https://eu.api.ovh.com/createToken/**

(Dla US/CA: `https://api.us.ovhcloud.com/createToken/`, `https://ca.api.ovh.com/createToken/`)

Zaloguj się tym samym kontem które ma środki do rejestracji domen + skonfigurowany payment method.

## 2. Wypełnij formularz

### Application name
```
MixtureMarketing — control-plane
```

### Application description
```
Hub API for klient provisioning: domain registration + DNS records.
```

### Validity
- **`Unlimited`** — żeby token nie wygasał (alternatywnie 1 rok jeśli wolisz rotację)

### Rules (Access rules)

**Skopiuj i wklej PO JEDNEJ LINII** — w polu wpisz w formacie `METHOD /path` (z dużej w `METHOD`):

```
GET /me
GET /domain
GET /domain/*
GET /domain/zone
GET /domain/zone/*
POST /domain/zone/*
PUT /domain/zone/*
DELETE /domain/zone/*
GET /order/cart/*
POST /order/cart
POST /order/cart/*
DELETE /order/cart/*
```

**Co każda reguła robi:**
| Reguła | Po co |
|--------|-------|
| `GET /me` | Health-check tokenu (verify-ovh.mjs) |
| `GET /domain*` | Lista zarejestrowanych domen klientów |
| `GET /domain/zone*` | Czytanie DNS zone |
| `POST/PUT/DELETE /domain/zone/*` | Tworzenie/edycja/usuwanie rekordów DNS (CNAME do CF Workers) |
| `GET /order/cart/*` | Stan zamówień domen |
| `POST /order/cart` | Utworzenie nowego cart (krok 1/4 rejestracji domeny) |
| `POST /order/cart/*` | Add domain do cart + assign + checkout |
| `DELETE /order/cart/*` | Cleanup sandbox cart w verify-script |

**`*` na końcu** = wildcard dla dowolnego path segment (np. `/domain/zone/kowalski-slusarz.pl/record`).

### URL przekierowania (Redirect URL)
**ZOSTAW PUSTE** — server-to-server flow, nie ma user redirect.

(To pole jest tylko dla OAuth-like flow `POST /auth/credential` gdzie OVH wysyła usera z powrotem do Twojej aplikacji. My używamy bezpośrednio "Create Token" co daje Consumer Key od razu.)

## 3. Po kliknięciu "Create keys" dostaniesz 3 wartości

```
Application Key:    aaaaaaaaaaaaaaaa
Application Secret: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
Consumer Key:       cccccccccccccccccccccccccccccccc
```

**Skopiuj je natychmiast** — OVH nie pokaże ich drugi raz. Application Secret szczególnie — można go tylko ZRESETOWAĆ, nie podejrzeć.

## 4. Lokalnie (dev) — wstaw do `.dev.vars`

```powershell
cd D:\KOD\binary-planet\apps\control-plane
Copy-Item .dev.vars.example .dev.vars   # (jeśli template istnieje; jak nie — utwórz)
notepad .dev.vars
```

Wpisz:
```
OVH_APP_KEY="aaaaaaaaaaaaaaaa"
OVH_APP_SECRET="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
OVH_CONSUMER_KEY="cccccccccccccccccccccccccccccccc"
OVH_ENDPOINT="ovh-eu"
PROVISIONING_DRY_RUN="false"
```

## 5. Sprawdź czy działa

```powershell
cd D:\KOD\binary-planet\apps\control-plane
node --env-file=.dev.vars scripts/verify-ovh.mjs
```

Oczekiwany output:
```
OVH credentials check — endpoint ovh-eu (https://eu.api.ovh.com/1.0)

  /auth/time reachable ... OK (server epoch 1716...)
  GET /me ... OK (nichandle=ab1234-ovh)
  GET /domain/zone ... OK (3 zones)
  GET /domain ... OK (3 domains)
  POST /order/cart (sandbox, then delete) ... OK (cartId=abc123 (cleaned up))

ALL CHECKS PASSED
```

Jeśli któryś krok FAIL → pokazuje która access rule brakuje. Wróć do https://eu.api.ovh.com/createToken/, wygeneruj nowy z poprawionymi regułami.

## 6. Produkcja — wstaw secrety do Worker

```powershell
cd D:\KOD\binary-planet\apps\control-plane
pnpm exec wrangler secret put OVH_APP_KEY
pnpm exec wrangler secret put OVH_APP_SECRET
pnpm exec wrangler secret put OVH_CONSUMER_KEY
# paste wartość gdy zapyta dla każdego
```

`OVH_ENDPOINT` i `PROVISIONING_DRY_RUN` to plain vars — można je dodać w wrangler.toml `[vars]` lub via `wrangler secret put` (działa też):
```powershell
pnpm exec wrangler secret put OVH_ENDPOINT     # → ovh-eu
pnpm exec wrangler secret put PROVISIONING_DRY_RUN  # → false
```

## 7. PaymentMean (wymaganie OVH dla auto-rejestracji domen)

Żeby `POST /order/cart/*/checkout` z `autoPayWithPreferredPaymentMethod: true` zadziałało:

1. Wejdź na **https://www.ovh.com/manager/** → Account → Billing → Means of payment
2. Dodaj kartę kredytową lub SEPA i ustaw jako **default**

Bez tego OVH cart checkout zwróci błąd "NO_PREFERRED_PAYMENT_MEAN" i provisioning failnie na kroku `ovh_register_domain`.

## 8. Production sanity check

Po deploy mm-control-plane:
```powershell
curl -X POST https://api.mixturemarketing.pl/api/admin/ovh/verify
```

(Endpoint TBD w kolejnym chunku — Track J5: Hub admin API. Tymczasowo użyj `verify-ovh.mjs` z `.dev.vars`.)

## Rotacja tokenu

Bezpieczeństwo: jeśli token wycieknie (np. trafi do logu / czata) — natychmiast:

1. https://www.ovh.com/manager/ → API → Applications → znajdź "MixtureMarketing — control-plane"
2. Klik **Revoke**
3. Wygeneruj nowy via createToken page, podmień secrety w Worker via `wrangler secret put`

## Limity API

OVH API ma rate limit ~50 req/min per source IP. Provisioning używa max 4 calls per klient (cart create → assign → domain → checkout) + 2 dla DNS (record create → refresh) = **6 calls / klient**. Bezpieczne do ~8 klientów/min co i tak nie wystąpi w normalnym onboardingu.
