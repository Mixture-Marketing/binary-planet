# P2: Google Business Profile API down

**Severity:** P2 — HIGH
**Response SLA:** 1h
**Fix SLA:** 24h
**Last updated:** 2026-05-18

## Symptoms

- Cron daily GBP pull (Faza 5) fail rate >50% w ostatnich 3 runs
- Klient: "nowa opinia nie pojawiła się w panelu"
- Logi: `403 Forbidden`, `429 Too Many Requests`, `500/503 Internal`
- GBP auto-post nie publikuje (4 posty/mc workflow stuck)
- Alert `gbp_api_error_rate > 5%`

## Impact

- Review monitoring broken → klient nie wie o nowych opiniach (3-dniowy SLA odpowiedzi na opinie = penalty od Google jeśli przekroczone)
- Auto-posting broken → spadek visibility GBP (Google rewardsuje aktywne profile)
- Insights pull broken → monthly report bez GBP data

**Nie krytyczne dla działania strony klienta.** Klient nie widzi błędu, tylko stale data.

## Diagnostic commands

```bash
# 1. Sprawdź Google API status
# Manualnie: status.cloud.google.com → search "Business Profile"

# 2. Sprawdź quota usage
# Manualnie: console.cloud.google.com → APIs → Business Profile API → Quotas
# Default: 100 req/min, 10000 req/dzień

# 3. Test API manualnie
# TODO: po Faza 5
curl -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  "https://mybusinessbusinessinformation.googleapis.com/v1/accounts/<ACCOUNT_ID>/locations/<LOCATION_ID>"

# 4. Sprawdź Service Account permissions
# Manualnie: search.google.com/search-console → check że bp-clients@... ma dostęp do property klienta

# 5. Sprawdź D1 dla failed cron logs
wrangler d1 execute mm-control-plane --command \
  "SELECT * FROM cron_runs WHERE job_name = 'gbp_daily_pull' ORDER BY started_at DESC LIMIT 5"
```

## Resolution steps

### Scenario A — Quota exceeded

```bash
# 1. Sprawdź usage
# Manualnie: GCP console → Quotas → Business Profile API

# 2. Jeśli prawie limit:
# - Krótkoterminowo: zmień cron z hourly na daily (mniejsza częstotliwość)
# - Długoterminowo: złóż quota increase request w GCP (Faza 0 do-do)

# 3. Backfill missed pulls później jak quota się odnowi (północ Pacific time)
```

### Scenario B — Service Account stracił dostęp do klienta

```bash
# 1. Identify który klient
wrangler d1 execute mm-control-plane --command \
  "SELECT client_id FROM gbp_sync_status WHERE last_error LIKE '%403%' OR last_error LIKE '%PERMISSION%'"

# 2. Email do klienta:
# "Otrzymałem informację że nasze konto SA nie ma już dostępu do Pana GBP.
#  Czy przypadkiem usunął Pan użytkownika 'bp-clients@binary-planet.iam.gserviceaccount.com'?
#  Proszę o ponowne dodanie..."

# 3. Klient przywraca → re-test
```

### Scenario C — Google API zwraca 500/503 (ich problem)

```bash
# 1. Czekaj na resolve (Google status page)
# 2. Cron retry exponential backoff — automatyczne
# 3. Status update do klienta tylko jeśli >24h fail

# Dashboard pokazuje "Last GBP sync: 2 days ago" warning — klient widzi
```

### Scenario D — OAuth token expired (jeśli ścieżka B nie A)

```bash
# Service Account ścieżka (A) nie ma tego problemu.
# OAuth ścieżka (B) — Google policy: re-auth co 6 mc.

# 1. Identify klient z stale token
wrangler d1 execute mm-control-plane --command \
  "SELECT client_id, gbp_oauth_expires_at FROM client_integrations WHERE gbp_oauth_expires_at < datetime('now', '+7 days')"

# 2. Email do klienta z magic link do re-auth
# (Implementacja: panel klienta → /reauth/gbp → OAuth flow)
```

## Verification

```bash
# 1. Cron next run zielony
# Manualnie: dashboard → Operations → Scheduled tasks → gbp_daily_pull → status

# 2. Test pull dla konkretnego klienta
# TODO: po Faza 5
wrangler dev mm-control-plane --test "gbp.pullForClient('<CLIENT_ID>')"
```

## Common causes

*(Pusta)*

## Postmortem

Tylko jeśli widoczne dla klienta (>24h stale data). Większość P2 GBP = ciche, fix bez incident report.
