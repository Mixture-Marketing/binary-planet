# P2: SSL certificate expiry < 7 dni

**Severity:** P2 — HIGH (zagraża eskalacją do P1 jeśli wygaśnie)
**Response SLA:** 1h
**Fix SLA:** 24h
**Last updated:** 2026-05-18

## Symptoms

- Alert cron `ssl_expiry_check` (daily, Faza 5): cert dla `<DOMAIN>` wygasa za <7 dni
- Better Stack / synthetic monitor SSL warning
- Klient (rzadko, ale możliwe): "moja strona pokazuje że certyfikat wygasa"

## Impact

- **Jeśli wygaśnie:** użytkownicy widzą "Not secure" w Chrome → utrata zaufania, spadek konwersji do 0
- **SEO impact:** Google deprioritizuje strony z invalid cert
- **Klauzula SLA:** automatyczny renew to nasza odpowiedzialność — breach jeśli wygaśnie

## Diagnostic commands

```bash
# 1. Sprawdź obecny cert
echo | openssl s_client -connect <DOMAIN>:443 -servername <DOMAIN> 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer

# 2. Sprawdź status custom hostname w CF for SaaS
# Manualnie: dash.cloudflare.com → SSL/TLS → Custom Hostnames → search <DOMAIN>
# Status powinien być "Active" + cert "Valid until: <date>"

# 3. Sprawdź czy DCV (Domain Control Validation) ok
# Manualnie: ten sam path → szczegóły hostname → "Validation method" + status

# 4. Sprawdź DNS — czy CNAME do CF nadal działa
dig CNAME <DOMAIN>
# Expected: bp-clients.cfargotunnel.com lub podobne (CF for SaaS edge)
```

## Resolution steps

### Scenario A — CF for SaaS automatic renew stuck

```bash
# CF normalnie renewuje 30 dni przed expiry. Jeśli stuck:

# 1. Trigger manual renew
# Manualnie: CF dash → Custom Hostnames → <DOMAIN> → Actions → "Re-verify"
# Lub przez API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/custom_hostnames/<HOSTNAME_ID>/verify" \
  -H "Authorization: Bearer $CF_API_TOKEN"

# 2. Sprawdź DCV status po 5 min
# Jeśli "valid" → cert się odnowi w 24h
```

### Scenario B — Klient zmienił DNS, DCV broken

```bash
# 1. Identify required DCV records
# CF dashboard pokazuje: "Add this TXT record: _cf-custom-hostname.<DOMAIN> = <value>"

# 2. Jeśli klient ma własną domenę: email z instrukcją
# "Proszę dodać TXT record: ..."

# 3. Jeśli domena pod OVH (nasza): dodaj programatycznie
# TODO: po Faza 0 — OVH API setup
ovh-cli domain zone <DOMAIN> record add --type TXT --subDomain "_cf-custom-hostname" --target "<value>"

# 4. Trigger re-verify
```

### Scenario C — Klient migruje domenę z innego CF SaaS

```bash
# Jeśli klient był wcześniej na innej platformie używającej CF for SaaS:
# Konflikt "domain already in use by another zone"

# 1. Klient musi usunąć stary custom hostname u poprzedniego providera
# 2. Po 1h DNS propagation → re-verify nasz hostname
```

### Scenario D — Cert authority issue (rzadko)

```bash
# CF używa Let's Encrypt / Google Trust Services. Jeśli ich problem:
# 1. CF status check
# 2. Czekać — CF auto-fallback do alternative CA
```

## Verification

```bash
# 1. Cert valid >30 dni
echo | openssl s_client -connect <DOMAIN>:443 2>/dev/null | openssl x509 -noout -dates
# notAfter powinien być za >30 dni

# 2. Browser test
# Manualnie: open https://<DOMAIN> → zielona kłódka, no warnings

# 3. SSL Labs grade
# curl https://api.ssllabs.com/api/v3/analyze?host=<DOMAIN>
# Expected: A lub A+
```

## Klient communication

**Tylko jeśli wymaga akcji klienta (Scenario B):**
```
Temat: Potrzebna szybka akcja: aktualizacja DNS

Dzień dobry,

Wykryłem że dla domeny [domena] potrzebujemy zaktualizować jeden rekord DNS,
żeby certyfikat SSL nadal się odnawiał automatycznie.

Co proszę zrobić:
1. Zalogować się do panelu DNS u Pana rejestratora ([nazwa])
2. Dodać rekord TXT:
   Nazwa: _cf-custom-hostname.[domena]
   Wartość: [token]
3. Zapisać

Po 1h sprawdzę i potwierdzę. Bez tej zmiany certyfikat wygaśnie [data]
i strona pokaże ostrzeżenie "Niezabezpieczona".

Mogę też zalogować się sam — jeśli prześle Pan dane dostępu na chwilę.
W razie pytań — proszę pisać.

Pozdrawiam,
Jakub
```

## Prevention

- **Cron `ssl_expiry_check` daily** (Faza 5) — alert 30/14/7/3/1 dzień przed expiry
- **Dashboard widget** — kolumna SSL expiry w clients list, kolor czerwony <7 dni
- **CF for SaaS health metrics** — alert jeśli wewnętrzny "renewal_status" != "active"

## Common causes

*(Pusta)*
