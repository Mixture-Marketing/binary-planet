# P1: D1 corruption / data loss

**Severity:** P1 — CRITICAL (data integrity)
**Response SLA:** 15 min (in-hours) / 30 min (weekend)
**Fix SLA:** 2h (UWAGA: 1h może być nierealne dla restore — komunikuj klientowi)
**Last updated:** 2026-05-18

## Symptoms

- Cloudflare alert: D1 read/write errors >5% w 5 min window
- SQL errors w wrangler tail: `SQLITE_CORRUPT`, `database disk image is malformed`, `attempt to write a readonly database`
- Synthetic monitor `dashboard.mixturemarketing.pl/health` zwraca 500
- Klient: "leady zniknęły z mojego dashboardu" / "stare zamówienia są ale nowe nie pokazują"
- D1 dashboard w CF: błędy zapisów rosną
- Backup cron alarmuje "snapshot incomplete"

## Impact

- **🔴 NAJWYŻSZY PRIORYTET — DATA INTEGRITY**
- Potencjalna utrata: leady, billing history, audit log, secrets metadata
- **RODO**: jeśli utrata danych osobowych → potencjalny breach, **72h zegar do UODO** + powiadomienie klientów dotkniętych
- Cały control plane może być sparaliżowany (D1 jako event store + transactional)
- **NIE PANIKUJ — mamy backupy R2 (O.4 backup strategy)**

## Diagnostic commands

```bash
# 1. Sprawdź integrity check
wrangler d1 execute mm-control-plane --command "PRAGMA integrity_check"
# Expected: "ok"
# Jeśli inne — corruption confirmed

# 2. Quick check która tabela
wrangler d1 execute mm-control-plane --command "PRAGMA quick_check"

# 3. Sprawdź ostatnie backupy
# R2 listing:
wrangler r2 object list mm-backups --prefix "d1/control-plane/" | sort -r | head -10
# Każdy backup = .sql.gz dump

# 4. Liczność rekordów w kluczowych tabelach (porównaj z ostatnim raportem)
wrangler d1 execute mm-control-plane --command "
  SELECT 'clients' AS t, COUNT(*) FROM clients
  UNION SELECT 'leads', COUNT(*) FROM leads
  UNION SELECT 'webhook_events', COUNT(*) FROM webhook_events
  UNION SELECT 'audit_log', COUNT(*) FROM audit_log
"

# 5. Sprawdź czy D1 region down
# Manualnie: dash.cloudflare.com → D1 → mm-control-plane → status

# 6. Sprawdź logi CF
wrangler tail mm-control-plane --format pretty | grep -i "d1\|sqlite\|database"
```

## Resolution steps

### KROK 0 — STOP WRITES (zapobiegnij dalszej korupcji)

```bash
# 1. Włącz maintenance mode w hub
wrangler kv:key put MAINTENANCE_MODE "true" --binding CONFIG --env production
# Spoke checks ten flag przed write → buforuje w fallback queue

# 2. Disable cron triggers tymczasowo
# Manualnie: CF dash → Workers → mm-control-plane → Triggers → Disable all crons
```

### Scenario A — Recoverable (single table issue)

```bash
# 1. Dump dotkniętej tabeli z backupu
LAST_BACKUP=$(wrangler r2 object list mm-backups --prefix "d1/control-plane/" | sort -r | head -1)
wrangler r2 object get mm-backups/$LAST_BACKUP --file /tmp/backup.sql.gz
gunzip /tmp/backup.sql.gz

# 2. Extract tylko tabelę dotkniętą
grep -A 999999 "CREATE TABLE leads" /tmp/backup.sql | grep -B 999999 "CREATE TABLE " | head -n -1 > /tmp/leads-restore.sql

# 3. Import z merge (zachowaj nowsze rekordy)
# UWAGA: tylko jeśli pewny że corruption tylko w jednej tabeli
wrangler d1 execute mm-control-plane --file /tmp/leads-restore.sql

# 4. Verify
wrangler d1 execute mm-control-plane --command "PRAGMA integrity_check"
```

### Scenario B — Full restore z backupu (large corruption)

```bash
# UWAGA: restore z backupu = utrata danych OD ostatniego backupu.
# Daily backup = max 24h utraty. Krytyczne: powiadomić klientów.

# 1. Identify last GOOD backup
wrangler r2 object list mm-backups --prefix "d1/control-plane/" | sort -r | head -5
# Wybierz najnowszy gdzie wiadomo że integrity OK

# 2. Pobierz backup
wrangler r2 object get mm-backups/<BACKUP_KEY> --file /tmp/backup.sql.gz
gunzip /tmp/backup.sql.gz

# 3. Create new D1 database (NIE nadpisuj broken — może zawierać newer data do recovery later)
wrangler d1 create mm-control-plane-restore-$(date +%s)
# Note new database_id

# 4. Import backup
wrangler d1 execute mm-control-plane-restore-<TIMESTAMP> --file /tmp/backup.sql

# 5. Update wrangler.toml control plane → nowy database_id
# Edit: bindings.d1_databases[0].database_id = "<NEW_ID>"

# 6. Redeploy control plane
wrangler deploy --env production

# 7. Verify
curl https://api.mixturemarketing.pl/api/health
# Expected: 200 + DB connected
```

### Scenario C — D1 region down (CF problem, not us)

```bash
# 1. CF status check
curl https://www.cloudflarestatus.com/api/v2/status.json | grep -i d1

# 2. Czekać na CF resolve + status update do klientów
# Manual: status.mixturemarketing.pl banner "CF D1 incident, monitoring"

# 3. Spoke fallback queue chroni leady — nic się nie traci w międzyczasie
```

### Scenario D — Restore z R2 + WAL replay (Faza 5+ jeśli mamy WAL streaming)

```bash
# TODO: po Faza 5 — Litestream-like WAL replication do R2
# Pozwoli na point-in-time recovery (zamiast full daily backup)
# Dla teraz: full backup daily wystarczy
```

### KROK FINALNY — Drain fallback queue ze spoke

```bash
# Po restore, wszystkie leady z fallback queue w spoke muszą być re-zsynchronizowane.

# 1. Disable maintenance mode
wrangler kv:key put MAINTENANCE_MODE "false" --binding CONFIG --env production

# 2. Re-enable cron triggers

# 3. Spoke automatycznie drainuje queue (cron co 5 min)
# Monitor:
wrangler tail mm-control-plane --format pretty | grep "lead_replay"
```

## Verification

```bash
# 1. Integrity check pass
wrangler d1 execute mm-control-plane --command "PRAGMA integrity_check"
# Expected: "ok"

# 2. Sample queries z każdej tabeli
wrangler d1 execute mm-control-plane --command "SELECT COUNT(*) FROM clients WHERE status='active'"
wrangler d1 execute mm-control-plane --command "SELECT MAX(created_at) FROM leads"

# 3. Health endpoint zielony
curl https://api.mixturemarketing.pl/api/health

# 4. Test form E2E na demo client
# (insert lead → expect w D1)

# 5. Spoke queue empty (po drain)
# wrangler kv:key list dla wszystkich klientów: empty

# 6. 30-min monitoring po restore — czy nowe writes nie crashuja
```

## Klient communication

**Jeśli utrata danych potencjalna:**
```
Temat: [WAŻNE] Incydent techniczny — sprawdzamy stan Pana danych

Dzień dobry,

Dziś o [czas] wystąpił problem techniczny z naszą bazą danych.
Naprawiliśmy go ([czas]), ale konieczne było przywrócenie z backupu.

Co to oznacza dla Pana:
- Strona [domena] działa normalnie
- Formularze przyjmują leady normalnie
- Możliwe że [X] leadów z dnia [data] nie pojawi się w Pana panelu

Co robię TERAZ:
- Sprawdzam ręcznie czy któryś lead nie wymaga osobnej synchronizacji
- Wyślę Panu raport w ciągu 24h z dokładną listą

W ramach klauzuli SLA otrzymuje Pan/Pani 1 miesiąc bezpłatnej subskrypcji.

Przepraszam za niedogodności.

Pozdrawiam,
Jakub
MixtureMarketing
```

**Jeśli utrata danych potwierdzona + dane osobowe (RODO breach):**
- **W 24h** — powiadomienie klienta (controllera) — szczegółowe
- **W 72h** — zgłoszenie do UODO (jeśli klient zdecyduje że breach materialne)
- Template w `legal-questions.md` deliverables (od prawnika)

## Common causes

*(Pusta)*

## Postmortem

**Wymagany.** Plus:

- **RODO incident log** wpis (Art. 33 RODO)
- **Audit czemu integrity check nie wykryło wcześniej** — czy potrzebujemy cron `PRAGMA integrity_check` częściej niż 1x dziennie?
- **Backup strategy review** — czy 24h RPO (recovery point objective) jest akceptowalne dla naszego SLA?

## Prevention

Reguły żeby zapobiegać D1 corruption:

1. **Migrations zawsze przez wrangler d1 migrations** — nigdy ad-hoc DDL na produkcji
2. **Pre-flight check przed migration** — `PRAGMA integrity_check` przed i po
3. **WRITES tylko z control plane** — spoke NIGDY nie pisze bezpośrednio do hub D1 (przez API)
4. **Backups co 24h + cross-region** (R2 EU + EU-West backup zone)
5. **Test restore co miesiąc** — restore do staging D1 + integrity check, dla pewności że backupy nie corrupted też
