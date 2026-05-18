# P1: Strona klienta offline

**Severity:** P1 — CRITICAL
**Response SLA:** 15 min (in-hours) / 30 min (weekend) / SMS only (sleep)
**Fix SLA:** 1h
**Last updated:** 2026-05-18

## Symptoms

- Alert z synthetic monitor: `HTTP status >= 500` lub timeout >3s
- Klient dzwoni "moja strona nie działa"
- Dashboard pokazuje `health_status: down` dla `<CLIENT_ID>`
- Better Stack alert (jeśli skonfigurowany)
- W przeglądarce: "521 Web server is down" (CF) / "522 Connection timed out" / "ERR_CONNECTION_REFUSED"

## Impact

- **Klient widzi błąd zamiast strony** → utrata zaufania, utrata leadów
- **Google indexing** — jeśli >24h offline, ryzyko spadku w rankingu
- **Conversion loss** — szacunek: leady/h × stawka godzinowa branży klienta
- **Klauzula SLA** — jeśli incydent >SLA, credit klienta (1 mc free dla P1 breach)

## Diagnostic commands

```bash
# 1. Sprawdź czy CF widzi Worker
# TODO: zastąp CLIENT_DOMAIN domeną klienta
curl -I https://<CLIENT_DOMAIN>/
curl -I https://<CLIENT_DOMAIN>/api/health

# 2. Sprawdź DNS — czy domena nadal wskazuje na CF
nslookup <CLIENT_DOMAIN>
dig <CLIENT_DOMAIN> +short

# 3. Sprawdź CF dashboard
# Manualnie: https://dash.cloudflare.com → Workers & Pages → <client-worker-name>
# Sprawdź: Latest deploy status, Errors graph (last 1h), CPU/memory limits

# 4. Sprawdź wrangler tail (live logs)
# TODO: dodaj alias gdy mm-control-plane gotowe
wrangler tail <client-worker-name> --format pretty

# 5. Sprawdź ostatni deploy
gh run list --repo mixturemarketing/mm-client-<CLIENT_ID> --limit 5

# 6. Sprawdź D1 dla per-client metadata (jeśli klient ma D1)
# TODO: wrangler d1 execute ...
```

## Resolution steps

### Scenario A — Worker deploy fail (ostatni deploy failed)

```bash
# 1. Identify last good deploy
gh run list --repo mixturemarketing/mm-client-<CLIENT_ID> --status success --limit 1
# Note the commit SHA

# 2. Rollback przez wrangler
cd /tmp/mm-client-<CLIENT_ID> && git checkout <GOOD_SHA>
wrangler deploy --env production

# Alternatywa: trigger redeploy z GitHub
gh workflow run deploy.yml --ref <GOOD_SHA> --repo mixturemarketing/mm-client-<CLIENT_ID>

# 3. Verify (patrz Verification poniżej)
```

### Scenario B — CF region/account issue

```bash
# 1. Sprawdź status CF
curl https://www.cloudflarestatus.com/api/v2/status.json

# 2. Jeśli incident CF — czekaj + status update do klienta + status page
# Manual: https://status.mixturemarketing.pl banner "Cloudflare incident, monitoring"

# 3. Jeśli region issue — Worker re-routing zwykle automatic, ale jeśli persist:
# Failover: deploy do Vercel standby (O.2 disaster recovery)
# TODO: link do ops-failover-to-vercel.md (do napisania w Fazie 6)
```

### Scenario C — DNS issue (domena nie wskazuje na CF)

```bash
# 1. Sprawdź NS records
dig NS <CLIENT_DOMAIN>

# 2. Jeśli klient ma własną domenę (nie pod naszym OVH):
#    - Sprawdź czy klient nie zmienił DNS w swoim panelu
#    - Skontaktuj się z klientem: "czy zmieniał Pan ostatnio DNS?"

# 3. Jeśli pod naszym OVH:
#    - Sprawdź OVH dashboard manualnie
#    - TODO: ovh-cli check domain <CLIENT_DOMAIN>

# 4. CF for SaaS custom hostname status
# Manualnie: CF dash → SSL/TLS → Custom Hostnames → search <CLIENT_DOMAIN>
# Status powinien być "Active"
```

### Scenario D — SSL/TLS cert issue

```bash
# 1. Sprawdź cert
echo | openssl s_client -connect <CLIENT_DOMAIN>:443 -servername <CLIENT_DOMAIN> 2>/dev/null | openssl x509 -noout -dates

# 2. Jeśli expired / invalid:
# CF for SaaS automatycznie renewuje, ale jeśli stuck:
# Manualnie: CF dash → SSL/TLS → Custom Hostnames → <CLIENT_DOMAIN> → "Renew"

# 3. Jeśli HTTPS strict mode i klient nie przeszedł DCV:
# Re-trigger DCV: CF dash → ten sam path → "Verify"
```

### Scenario E — Klient sam wyłączył coś przypadkiem

- Sprawdź Sveltia commit history w `mm-client-<CLIENT_ID>` repo
- Jeśli klient zmienił config (np. odłączył domenę w `client.config.ts`) — revert ostatniego commit + powiadom klienta

## Verification

```bash
# 1. HTTP 200 z każdego regionu
curl -I https://<CLIENT_DOMAIN>/
curl -I https://<CLIENT_DOMAIN>/kontakt
curl -I https://<CLIENT_DOMAIN>/api/health

# 2. Time to first byte <500ms
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" https://<CLIENT_DOMAIN>/

# 3. Synthetic monitor next run zielony
# Dashboard: app.mixturemarketing.pl/clients/<CLIENT_ID>/health

# 4. Test form submission (E2E)
curl -X POST https://<CLIENT_DOMAIN>/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@test.pl","message":"runbook test","consent":true}'
# Expected: 200 + lead w D1 control plane
```

## Klient communication

**Podczas incydentu (po 5 min downtime):**
```
Temat: [URGENT] Tymczasowy problem z Pana stroną

Dzień dobry,

Otrzymaliśmy alert że strona [domena] nie jest dostępna od [czas] UTC.
Już pracuję nad rozwiązaniem — wstępna diagnoza: [krótki opis].

Szacowany czas naprawy: [X min]. Aktualizacje co 15 min.

Status: https://status.mixturemarketing.pl

Pozdrawiam,
Jakub
MixtureMarketing
```

**Po fix (zawsze):**
```
Temat: Strona przywrócona — co się stało

Strona [domena] działa od [czas].
Łączny czas niedostępności: X minut.

Przyczyna: [1-2 zdania w przystępnym języku].
Co zrobiliśmy: [1-2 zdania].
Co robimy żeby się nie powtórzyło: [1-2 zdania].

[Jeśli SLA breach: "W ramach klauzuli SLA otrzyma Pan/Pani 1 miesiąc bezpłatnej subskrypcji."]

W razie pytań — proszę pisać.

Pozdrawiam,
Jakub
```

## Common causes (historia incydentów)

*(Pusta — wypełniamy po pierwszych incydentach)*

## Postmortem

**Wymagany dla każdego P1.** Termin: 48h od resolved. Template w [README.md](README.md).

Archiwum: `runbooks/postmortems/YYYY-MM-DD-site-offline-<CLIENT_ID>.md`
