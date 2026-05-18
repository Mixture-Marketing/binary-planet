# Runbooks — binary-planet / MixtureMarketing

Operacyjne procedury reagowania na incydenty. Cel: w kryzysie nie myślisz, tylko wykonujesz.

## Jak używać

1. **Alert przychodzi** (email/SMS/Slack) → otwierasz odpowiedni runbook
2. **Sprawdzasz Symptoms** — czy to faktycznie ten incydent
3. **Sprawdzasz Impact** — kogo dotyczy, czy musisz powiadomić klienta
4. **Wykonujesz Diagnostic commands** — copy-paste, nie kombinujesz
5. **Wykonujesz Resolution steps** — w kolejności, nie skipujesz
6. **Verification** — potwierdzasz że działa
7. **Postmortem** — jeśli P1, piszesz w 48h

## Indeks runbooków

### Incident response (P1 — CRITICAL, response 15 min)

- [P1-client-site-offline.md](P1-client-site-offline.md) — strona klienta nie odpowiada >5 min
- [P1-lead-form-broken.md](P1-lead-form-broken.md) — formularz kontaktowy nie zapisuje leadów
- [P1-stripe-webhook-failure.md](P1-stripe-webhook-failure.md) — Stripe webhook fail, ryzyko utraty przychodu
- [P1-d1-corruption.md](P1-d1-corruption.md) — korupcja danych w D1 / utrata danych

### Incident response (P2 — HIGH, response 1h)

- [P2-gbp-api-down.md](P2-gbp-api-down.md) — Google Business Profile API zwraca błędy
- [P2-ssl-expiry-imminent.md](P2-ssl-expiry-imminent.md) — certyfikat SSL wygasa <7 dni
- [P2-anthropic-rate-limit.md](P2-anthropic-rate-limit.md) — Anthropic API rate limit / >5% error rate

### Incident response (P3 — MEDIUM, response 24h)

- [P3-sveltia-bug.md](P3-sveltia-bug.md) — bug w Sveltia CMS, klient nie może edytować

### Operations (planowane, nie incidenty)

- [ops-rotate-secrets.md](ops-rotate-secrets.md) — rotacja kluczy API (kwartalna)
- [ops-onboard-new-client.md](ops-onboard-new-client.md) — manual fallback dla auto-provisioning
- [ops-restore-from-backup.md](ops-restore-from-backup.md) — przywracanie z R2 backup
- [ops-deploy-fleet-update.md](ops-deploy-fleet-update.md) — push update do wszystkich klientów *(TODO Faza 5)*
- [ops-handoff-to-va.md](ops-handoff-to-va.md) — onboarding VA do obsługi P2/P3 *(TODO Faza 8)*

### Reference

- [severity-matrix.md](severity-matrix.md) — definicje P1/P2/P3/P4 + SLA + eskalacje
- [alert-routing.md](alert-routing.md) — kto dostaje jaki alert i kiedy
- [secrets-inventory.md](secrets-inventory.md) — wszystkie sekrety + polityka rotacji

## Struktura każdego runbooka

```
# [Tytuł]
**Severity / Response SLA / Fix SLA / Last updated**

## Symptoms       — jak to wygląda w alercie/dashboard
## Impact         — kto dotknięty, co się dzieje
## Diagnostic     — copy-paste commands do sprawdzenia
## Resolution     — step-by-step procedura naprawy
## Verification   — jak potwierdzić że działa
## Common causes  — historyczne przyczyny (rośnie po incydentach)
## Postmortem     — kiedy wymagane + template
```

## Convention

- **Wszystkie placeholdery** (`<CLIENT_ID>`, `<DOMAIN>`, etc.) — wyraźnie oznaczone w `<...>` żeby nie pomylić z literałem
- **Komendy z prefixem `# TODO:`** — nie działają jeszcze, infrastruktura nie zbudowana (Faza 1+). Trzymane jako szablon
- **Po każdym incydencie** — update `Common causes` w odpowiednim runbooku + jeśli root cause systemowy → fix w kodzie

## Postmortem template

Po każdym P1 (i P2 widocznych dla klienta) — w 48h:

```markdown
# Postmortem: [Incident name] — YYYY-MM-DD

**Severity:** P1/P2
**Start:** YYYY-MM-DD HH:MM
**Detection:** HH:MM (X min after start)
**Resolution:** HH:MM (X min after detection)
**Duration:** X min total

## Klient(ów) dotkniętych
- ...

## Co się stało
- Chronologia, 5-7 punktów

## Root cause
- ...

## Co zadziałało
- ...

## Co nie zadziałało / co poprawić
- ...

## Action items
- [ ] ... (z owner + due date)

## Update runbooka
- Plik: ...
- Co dodać do "Common causes"
```

Archiwum: `runbooks/postmortems/YYYY-MM-DD-<slug>.md`
