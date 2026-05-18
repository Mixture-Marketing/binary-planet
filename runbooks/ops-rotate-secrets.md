# OPS: Rotacja sekretów

**Typ:** Planowana operacja (kwartalna) lub on-demand (compromise)
**Czas trwania:** ~30 min per secret (rolling) + 7 dni grace period
**Last updated:** 2026-05-18

Patrz [secrets-inventory.md](secrets-inventory.md) dla pełnej listy sekretów + harmonogramu.

## Kiedy rotować

1. **Kwartalny harmonogram** — cron alert 30 dni przed expires_at
2. **On-demand compromise** — natychmiastowo (patrz [secrets-inventory.md](secrets-inventory.md) "Compromise scenarios")
3. **Po offboarding VA/partnera** — w 1h od decyzji

## Rolling rotation procedure (general)

Cel: zero downtime przez 7-dniowy overlap dwóch wersji klucza.

```
Day 0:  Generate v(N+1), deploy obok v(N). Both active.
Day 0+: App używa v(N+1). v(N) nadal valid (fallback).
Day 7:  Revoke v(N). Tylko v(N+1) active.
```

## Per-secret procedures

### Anthropic API Key

```bash
# 1. Wygeneruj nowy klucz
# Manualnie: console.anthropic.com → API Keys → Create Key
# Nazwa: "mm-control-plane-q2-2026" (versioning w nazwie)
# Skopiuj wartość → 1Password vault entry "ANTHROPIC q2 2026"

# 2. Deploy obok starego (rolling)
echo "<NEW_KEY>" | wrangler secret put ANTHROPIC_API_KEY_NEW --env production --name mm-control-plane

# 3. Update kod aby próbował NEW first, fallback OLD
# mm-control-plane/src/lib/anthropic-client.ts:
# const key = env.ANTHROPIC_API_KEY_NEW || env.ANTHROPIC_API_KEY;

# 4. Deploy
wrangler deploy --env production

# 5. Monitor 24h — errors related do auth
wrangler tail mm-control-plane --format pretty | grep -i "401\|anthropic"

# 6. Po 7 dniach: usuń stary
# Manualnie: console.anthropic.com → revoke OLD key
# wrangler secret delete ANTHROPIC_API_KEY --env production
# Edit code: usuń fallback
# wrangler secret put ANTHROPIC_API_KEY (rename NEW → primary)
# wrangler secret delete ANTHROPIC_API_KEY_NEW

# 7. Update D1
wrangler d1 execute mm-control-plane --command \
  "UPDATE secrets_inventory 
   SET kid = '<NEW_KID>', current_version = current_version + 1, 
       rotated_at = datetime('now'), expires_at = datetime('now', '+90 days')
   WHERE secret_type = 'anthropic_api_key' AND client_id IS NULL"
```

### DataForSEO / Resend / SMSAPI (analogiczne)

Ten sam pattern. Różnice:

- **DataForSEO** — używa login+password (basic auth), więc rotacja = zmiana password w panelu
- **Resend** — można mieć multiple API keys aktywne jednocześnie (revoke explicit), super dla rolling
- **SMSAPI** — token w panelu, generate new + revoke old

### Stripe Secret Key (semi-annual)

```bash
# Stripe nie pozwala na multiple secret keys jednocześnie (per environment).
# Rolling impossible — robisz cutover.

# 1. Off-hours (np. niedziela 03:00) — minimal traffic
# 2. Generate new key w Stripe dashboard → Developers → API keys → Roll
# 3. Update wrangler secret IMMEDIATELY (Stripe automatycznie revokes old)
# 4. Deploy
# 5. Monitor next 1h intensively — wszystkie Stripe ops

# Tip: Stripe pokazuje "Rolling" UI — kliknij "Reveal" przed rollem, save w 1Password
```

### Stripe Webhook Secret (on-demand)

```bash
# Niezależne od API key. Rotujesz tylko po podejrzeniu compromise lub change endpoint URL.

# 1. W Stripe dashboard: Webhooks → <endpoint> → "Roll secret"
# 2. Skopiuj nowy whsec_...
# 3. wrangler secret put STRIPE_WEBHOOK_SECRET
# 4. Deploy
# 5. Stripe verify: replay test event z dashboard
```

### BP_CLIENT_API_KEY (per klient, kwartalna)

```bash
# Automatyczne (cron). Manual procedure dla ad-hoc rotation:

# 1. Wygeneruj nowy
NEW_KEY="ck_live_$(openssl rand -hex 32)"

# 2. Hash dla D1
NEW_HASH=$(echo -n "$NEW_KEY" | sha256sum | cut -d' ' -f1)

# 3. Update D1 (klient zachowuje 7-dniowy overlap — hub akceptuje OBA klucze)
wrangler d1 execute mm-control-plane --command \
  "UPDATE clients 
   SET api_key_hash_new = '$NEW_HASH', api_key_rotated_at = datetime('now')
   WHERE id = '<CLIENT_ID>'"

# 4. Deploy nowy klucz do spoke
echo "$NEW_KEY" | wrangler secret put BP_CLIENT_API_KEY --name mm-client-<CLIENT_ID>
wrangler deploy --env production --name mm-client-<CLIENT_ID>

# 5. Po 7 dniach (cron auto):
# UPDATE clients SET api_key_hash = api_key_hash_new, api_key_hash_new = NULL
# Hub przestaje akceptować stary klucz
```

### CF API Token (kwartalna)

```bash
# UWAGA: tym tokenem control plane deployuje siebie i klientów.
# Rotacja bez care = możliwy lockout.

# 1. Stwórz NOWY token w CF dashboard:
# - Scope: tylko niezbędne (Workers Edit, DNS Edit, R2 Edit, D1 Edit, KV Edit)
# - Account: tylko nasze konto MM
# - Duration: 90 dni z auto-rotation reminder

# 2. Test new token przed switchem:
CF_API_TOKEN_NEW=<new> curl https://api.cloudflare.com/client/v4/user/tokens/verify \
  -H "Authorization: Bearer $CF_API_TOKEN_NEW"
# Expected: success: true

# 3. Update wrangler config / control plane secret
echo "<NEW>" | wrangler secret put CF_API_TOKEN --env production --name mm-control-plane

# 4. GitHub Actions secrets update (dla auto-deploy klientów)
gh secret set CF_API_TOKEN --body "<NEW>" --repo mixturemarketing/<repo>

# 5. Test deploy z nowym tokenem (do staging client)
wrangler deploy --env staging

# 6. Po success: revoke old token w CF dashboard
```

### GitHub App private key (semi-annual)

```bash
# 1. GH App settings → Private keys → Generate new
# 2. Download .pem
# 3. wrangler secret put GH_APP_PRIVATE_KEY (multi-line — użyj heredoc)
# 4. Test: GH App authentication endpoint
# 5. Delete old key z GH dashboard po 7 dniach
```

### Google Service Account JSON (annual)

```bash
# 1. GCP console → IAM → Service Accounts → bp-clients@... → Keys → Add Key → Create new
# 2. Download JSON
# 3. Encode base64 (multi-line JSON kłopotliwy w wrangler):
base64 -i service-account.json | wrangler secret put GOOGLE_SERVICE_ACCOUNT_B64 --env production
# 4. Kod decoduje base64 przed użyciem
# 5. Test: GSC + GA4 + GBP API call
# 6. Delete old key w GCP po 30 dniach (Google pozwala dłużej dla bezpieczeństwa)
```

### D1 encryption key (annual lub per breach)

```bash
# To NAJBARDZIEJ NIEBEZPIECZNA rotacja — dane są szyfrowane tym kluczem.

# 1. Generuj nowy klucz
NEW_KEY=$(openssl rand -hex 32)

# 2. Deploy obok starego (kod używa key versioning — kid identifier)
echo "$NEW_KEY" | wrangler secret put D1_ENCRYPTION_KEY_V2 --env production

# 3. Re-encrypt wszystkie wiersze (batch cron, może trwać godziny dla dużej D1):
# Pseudo-code:
# for row in encrypted_table:
#   decrypted = decrypt(row.data, OLD_KEY, row.kid)
#   row.data = encrypt(decrypted, NEW_KEY, 'v2')
#   row.kid = 'v2'
#   save

# 4. Po complete: kod używa V2 only
# 5. Po 30 dniach: delete OLD_KEY secret
```

## Compromise — emergency procedure

Jeśli podejrzewasz że klucz wyciekł:

```bash
# 1. ROTATE IMMEDIATELY (skip rolling — straight cutover, akceptujesz krótki downtime)

# 2. Audit log
# - SaaS dashboard: ostatnie API calls od momentu compromise
# - D1: wszystkie webhook_events, ai_calls, etc. — szukaj anomalii

# 3. Powiadom klientów dotkniętych
# Jeśli BP_CLIENT_API_KEY <CLIENT_ID> compromise — tylko ten klient
# Jeśli shared key (Anthropic) — wszystkich (template w odpowiednich runbookach)

# 4. RODO breach assessment
# Czy compromise dotyczy danych osobowych?
# Jeśli TAK + materialne ryzyko → UODO w 72h

# 5. Post-rotation audit (1 tydzień)
# Monitoring intensywny czy nic anomalnego dalej
```

## Verification

```bash
# Po każdej rotacji:

# 1. Test critical path z nowym kluczem
# (np. dla Stripe — test charge w test mode; dla Anthropic — generate test content)

# 2. Sprawdź D1 secrets_inventory zaktualizowane
wrangler d1 execute mm-control-plane --command \
  "SELECT secret_type, current_version, rotated_at, expires_at, status FROM secrets_inventory ORDER BY rotated_at DESC LIMIT 10"

# 3. Sprawdź audit log
wrangler d1 execute mm-control-plane --command \
  "SELECT * FROM secret_rotation_log ORDER BY rotated_at DESC LIMIT 5"

# 4. Monitor 24h error rates
```

## Common pitfalls

- **Stripe Roll** zmienia klucz natychmiast — masz <1 sek na update wrangler. **Zawsze** miej drugi terminal gotowy.
- **GH App private key** to PEM file (wieloliniowy). `wrangler secret put` z pliku, nie z echo.
- **Anthropic billing** — po rotacji sprawdź czy invoicing nadal działa na nowy klucz (rzadko, ale możliwe że trzeba przepiąć w billing).
- **Per-client API keys** — jeśli klient ma static integration (rzadkie, ale możliwe) — powiadom przed rotacją.

## Update log

- **2026-05-18** — pierwsza wersja
