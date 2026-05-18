# OPS: Przywracanie z backupu (R2 snapshots)

**Typ:** Disaster recovery / point-in-time restore
**Czas trwania:** 30 min – 4h zależnie od scope
**Last updated:** 2026-05-18

Patrz [O-disaster-recovery.md](../plan/O-disaster-recovery.md) dla pełnej strategii DR + [P1-d1-corruption.md](P1-d1-corruption.md) dla incident path.

## Kiedy używać

- D1 corruption (P1) — patrz [P1-d1-corruption.md](P1-d1-corruption.md)
- Misclick admin — przypadkowo skasowane klient/lead/faktura
- Migration broken — DDL change zepsuło dane, rollback potrzebny
- Compliance request — point-in-time data dump dla audytu / RODO request

## Backup strategia (referencja)

Wszystko w `r2://mm-backups/`:

| Source | Frequency | Retention | Path |
|--------|-----------|-----------|------|
| D1 control-plane | Daily 04:00 UTC | 30 dni daily + 12 mc monthly | `d1/control-plane/YYYY-MM-DD.sql.gz` |
| D1 per-client (jeśli używany) | Daily | 30 dni | `d1/clients/<CLIENT_ID>/YYYY-MM-DD.sql.gz` |
| R2 client uploads (logos, zdjęcia) | Cross-region replicate (real-time) | indefinite | `mm-uploads-replica/` (separate bucket, EU-West) |
| Worker code (per klient) | Każdy deploy + git tags | indefinite (GitHub) | `github.com/mixturemarketing/mm-client-*` |
| Secrets metadata | Daily | 30 dni | `d1/control-plane/` (część backup) |
| Audit log | Weekly cold export | 7 lat (RODO) | `audit-cold/YYYY/MM/log.jsonl.gz` |

## Pre-flight checks (zawsze przed restore)

```bash
# 1. Identify ostatni GOOD backup
wrangler r2 object list mm-backups --prefix "d1/control-plane/" | sort -r | head -10
# Wybierz: ostatni przed czasem incydentu

# 2. Verify backup integrity (download + checksum)
LAST_BACKUP="d1/control-plane/2026-05-17.sql.gz"
wrangler r2 object get mm-backups/$LAST_BACKUP --file /tmp/backup.sql.gz

# Backup powinien mieć .sha256 obok:
wrangler r2 object get mm-backups/${LAST_BACKUP}.sha256 --file /tmp/backup.sha256
cd /tmp && sha256sum -c backup.sha256
# Expected: backup.sql.gz: OK

# 3. Test extract (czy nie corrupted sam backup)
gunzip -t /tmp/backup.sql.gz
# Brak output = OK

# 4. Sprawdź rozmiar (sanity check vs poprzednie)
ls -lh /tmp/backup.sql.gz
# Jeśli backup nagle 10x mniejszy niż poprzednie — uważaj, może być incomplete
```

## Scenarios

### Scenario A — Single row restore (misclick, klient skasowany)

```bash
# Najmniej intrusive: extract konkretny wiersz, insert do live D1.

# 1. Get backup
gunzip -c /tmp/backup.sql.gz > /tmp/backup.sql

# 2. Extract INSERT statements dla konkretnego klienta
grep "INSERT INTO clients.*'<CLIENT_ID>'" /tmp/backup.sql > /tmp/client-restore.sql

# 3. Sprawdź czy faktycznie kasowanie / corruption
# (nie chcesz nadpisać aktualnych danych)

# 4. Insert do live D1
wrangler d1 execute mm-control-plane --file /tmp/client-restore.sql

# 5. Repeat dla related tables (leads, payments, etc.) z tym samym client_id
```

### Scenario B — Single table restore

```bash
# np. tabela `audit_log` corrupted, reszta OK.

# 1. Extract table
gunzip -c /tmp/backup.sql.gz | awk '
  /^CREATE TABLE audit_log/{p=1}
  p
  /^CREATE TABLE / && !/audit_log/{p=0}
' > /tmp/audit-restore.sql

# 2. W live D1: DROP + CREATE + INSERT
wrangler d1 execute mm-control-plane --command "DROP TABLE audit_log"
wrangler d1 execute mm-control-plane --file /tmp/audit-restore.sql
```

### Scenario C — Full D1 restore (corruption — patrz P1-d1-corruption.md)

```bash
# 1. Create NEW D1 (nie nadpisuj broken):
NEW_DB=$(wrangler d1 create mm-control-plane-restore-$(date +%s) --json | jq -r '.uuid')
echo "New DB ID: $NEW_DB"

# 2. Import backup
gunzip -c /tmp/backup.sql.gz > /tmp/backup.sql
wrangler d1 execute mm-control-plane-restore-<TIMESTAMP> --file /tmp/backup.sql

# 3. Verify
wrangler d1 execute mm-control-plane-restore-<TIMESTAMP> --command "PRAGMA integrity_check"
# Expected: ok

wrangler d1 execute mm-control-plane-restore-<TIMESTAMP> --command "
  SELECT 'clients', COUNT(*) FROM clients
  UNION SELECT 'leads', COUNT(*) FROM leads
"
# Porównaj z ostatnim daily report

# 4. Update wrangler.toml control plane → nowy DB ID
# Edit: bindings.d1_databases[0].database_id = "$NEW_DB"

# 5. Redeploy control plane
cd /path/to/mm-control-plane
wrangler deploy --env production

# 6. Sanity check live API
curl https://api.mixturemarketing.pl/api/health
```

### Scenario D — Point-in-time restore (np. między backupami)

```bash
# Daily backup = max 24h RPO. Jeśli potrzeba dokładniej:

# 1. Audit log replay (jeśli mamy audit od ostatniego backupu w R2)
# Pseudo:
# - Restore z ostatniego daily backup
# - Get audit_log entries z R2 od czasu backup do czasu incydentu
# - Replay change events (INSERT/UPDATE/DELETE) na restored D1
# - Wymaga code: mm-control-plane/scripts/audit-replay.ts (TODO Faza 6)

# 2. Alternatywa: prosić klientów których to dotyczy o re-submit
# (Tylko dla leadów — nie ma realnej alternatywy dla recovery)
```

### Scenario E — R2 uploads restore (klient skasował logo)

```bash
# Cross-region replica → restore z replica:

# 1. Find file w replica bucket
wrangler r2 object list mm-uploads-replica --prefix "clients/<CLIENT_ID>/"

# 2. Copy back do primary
wrangler r2 object get mm-uploads-replica/<KEY> --file /tmp/file
wrangler r2 object put mm-uploads/<KEY> --file /tmp/file
```

### Scenario F — Worker code restore (deploy zepsuło coś)

```bash
# 1. Rollback przez wrangler
wrangler rollback --env production --name mm-client-<CLIENT_ID>

# Alternatywa: redeploy z git tag
cd /tmp && gh repo clone mixturemarketing/mm-client-<CLIENT_ID>
cd mm-client-<CLIENT_ID> && git checkout <LAST_GOOD_TAG>
wrangler deploy --env production
```

## Verification (zawsze po restore)

```bash
# 1. Integrity check
wrangler d1 execute mm-control-plane --command "PRAGMA integrity_check"

# 2. Critical queries
wrangler d1 execute mm-control-plane --command "
  SELECT id, name, status, tier FROM clients ORDER BY created_at DESC LIMIT 10
"

# 3. End-to-end test
# - Submit test lead na demo client
# - Verify w D1
# - Verify email delivered

# 4. Klient communication (jeśli widoczne)
# - Krótki email "Naprawione, status danych: ..."

# 5. Monitor 24h
```

## Post-restore actions

```bash
# 1. Document w postmortem
# - Co straciliśmy (od ostatniego backupu)
# - Czy klient został powiadomiony
# - Czy SLA breach (credit klientowi)

# 2. Audit czemu backup restore był potrzebny
# - Root cause analysis
# - Czy preventable
# - Action items

# 3. Test backup procedure jeśli to było pierwszy raz dla tego typu restore
# (Update runbook z lessons learned)

# 4. Verify NEXT daily backup ran successfully (nie chcemy lukę po restore)
```

## Test restore (miesięczna ćwiczenie)

**Cel:** Backup który nie był testowany NIE JEST backupem.

Cron miesięczny (1. dzień mc, 06:00 UTC):
1. Auto-restore ostatniego daily backup do staging D1
2. `PRAGMA integrity_check` + sample queries
3. Email raport do Jakuba: "Backup OK / FAIL"
4. Jeśli FAIL — natychmiastowy P1 alert (backupy są corrupted, większy problem)

TODO: implementacja w Fazie 5.

## Common pitfalls

- **Restore na live D1 bez backup current state** — możesz stracić więcej. Zawsze: backup current → restore.
- **Forgot PRAGMA integrity_check po restore** — restored DB może być sama corrupted jeśli backup był corrupted.
- **DNS cached** — jeśli zmieniasz D1 ID w wrangler.toml, redeploy potrzebny żeby Workers picked new binding.
- **Per-client backups dla wszystkich klientów** — gdy ich liczba urośnie do 100+, full daily backup z R2 może mieć cost impact. Monitor.

## Update log

- **2026-05-18** — pierwsza wersja
