# mm-control-plane — D1 migrations

D1 (Cloudflare SQLite) schema dla hub-and-spoke architektury. 9 migracji, **37 tabel, 110 indexów**, walidacja przez node:sqlite.

**Status:** v0.1 — Track C done. Schema gotowy do `wrangler d1 migrations apply` po założeniu D1 instance (Faza 1).

## Konwencje

- **Pliki:** `NNNN_descriptive_name.sql`, numeracja sekwencyjna, never re-order
- **Idempotency:** każda migracja samowystarczalna, no cross-file dependencies poza FK
- **Foreign keys:** `PRAGMA foreign_keys = ON` (D1 default w produkcji)
- **Primary keys:** `TEXT` dla slug/UUID-style ID, `INTEGER PRIMARY KEY AUTOINCREMENT` dla logów
- **Timestamps:** `TEXT` w ISO 8601, default `(datetime('now'))`
- **Booleans:** `INTEGER 0/1` (SQLite convention)
- **Enums:** `CHECK (col IN (...))` constraints na `TEXT`
- **JSON:** kolumny named `*_json`, access przez `json_extract(col, '$.field')`
- **PII:** kolumny `*_enc` (encrypted at app layer per-tenant key) + `*_hash` (sha256 dla lookup/dedup)
- **Retention:** RODO-relevant tables mają `delete_after` z DEFAULT 24mc + soft delete via `deleted_at`

## Migracje

| # | Plik | Tabele | Cel |
|---|------|--------|-----|
| 0001 | [init_clients.sql](0001_init_clients.sql) | `clients`, `client_contacts` | Foundation — wszystko FK'uje do clients |
| 0002 | [billing.sql](0002_billing.sql) | `subscriptions`, `payments`, `invoices` | Stripe + P24 + Fakturownia; grosze (INT) nie float |
| 0003 | [leads.sql](0003_leads.sql) | `leads`, `lead_replay_log` | Central D1 leady ze wszystkich klientów; PII encrypted; auto 24mc retention; fallback queue replay |
| 0004 | [seo_metrics.sql](0004_seo_metrics.sql) | `seo_metrics`, `keyword_rankings`, `citations`, `health_checks` | GSC + GA4 + GBP + Lighthouse + CrUX + DataForSEO + synthetic monitor |
| 0005 | [gbp_blog.sql](0005_gbp_blog.sql) | `gbp_reviews`, `review_requests`, `gbp_posts`, `blog_drafts` | Reputation pipeline + AI blog workflow (Faza 7) |
| 0006 | [compliance.sql](0006_compliance.sql) | `audit_log`, `consent_log`, `dpa_signatures`, `rodo_requests`, `breach_log` | RODO Art. 5, 7, 13–22, 28, 30, 32–34 |
| 0007 | [ops.sql](0007_ops.sql) | `webhook_events`, `secrets_inventory`, `secret_rotation_log`, `cron_runs`, `ai_calls`, `alerts`, `background_jobs` | Operational backbone — webhooks idempotency, secret rotation, AI cost tracking, alerts |
| 0008 | [crm.sql](0008_crm.sql) | `prospects`, `prospect_interactions`, `email_campaigns`, `email_sends` | Sales pipeline (cold outreach, wizard abandoned recovery, drip campaigns) |
| 0009 | [integrations.sql](0009_integrations.sql) | `client_integrations`, `feature_flag_overrides`, `admin_users`, `admin_sessions`, `panel_sessions`, `schema_migrations` | OAuth tokens encrypted, feature flags, internal/panel auth |

## Cross-cutting tables (referenced w runbooks)

| Runbook | Table |
|---------|-------|
| [P1-lead-form-broken.md](../../../runbooks/P1-lead-form-broken.md) | `leads`, `lead_replay_log`, `webhook_events` |
| [P1-stripe-webhook-failure.md](../../../runbooks/P1-stripe-webhook-failure.md) | `webhook_events`, `subscriptions`, `payments` |
| [P1-d1-corruption.md](../../../runbooks/P1-d1-corruption.md) | All tables (full restore) |
| [P2-anthropic-rate-limit.md](../../../runbooks/P2-anthropic-rate-limit.md) | `ai_calls` (cost tracking + kill switch query) |
| [P2-gbp-api-down.md](../../../runbooks/P2-gbp-api-down.md) | `cron_runs`, `client_integrations`, `gbp_reviews` |
| [P2-ssl-expiry-imminent.md](../../../runbooks/P2-ssl-expiry-imminent.md) | `health_checks` (`ssl_expires_at`) |
| [ops-rotate-secrets.md](../../../runbooks/ops-rotate-secrets.md) | `secrets_inventory`, `secret_rotation_log` |
| [ops-onboard-new-client.md](../../../runbooks/ops-onboard-new-client.md) | `clients`, `subscriptions`, `client_integrations` |
| [ops-restore-from-backup.md](../../../runbooks/ops-restore-from-backup.md) | All (per scenario) |

## Lokalna walidacja (przed deploy)

```bash
# Wymaga: Node 22.5+ z --experimental-sqlite (Node 25 ma to wbudowane)
node --experimental-sqlite apps/control-plane/migrations/.validate.mjs
node --experimental-sqlite apps/control-plane/migrations/.smoke-test.mjs
```

Aktualny status walidacji:
- **9/9 migracji** apply clean
- **13/13 smoke testów** pass (insert, CHECK, FK CASCADE, UNIQUE, retention DEFAULT, RODO, secrets dedup)
- **37 tabel, 110 indexów, 0 triggerów**

## Deploy na D1 (gdy mm-control-plane ready)

```bash
# 1. Stwórz D1 instance (Faza 1)
wrangler d1 create mm-control-plane

# 2. Note database_id z output → wpisz w wrangler.toml control plane:
# [[d1_databases]]
# binding = "DB"
# database_name = "mm-control-plane"
# database_id = "<uuid>"

# 3. Apply migracje (wrangler ścieżkę z migrations_dir w wrangler.toml)
wrangler d1 migrations apply mm-control-plane --env production

# 4. Verify
wrangler d1 execute mm-control-plane --command "SELECT COUNT(*) FROM schema_migrations"
# Expected: 9
```

## Przyszłe zmiany schemy

1. **Nigdy** nie edytuj istniejących migracji po deploy. Zawsze new migration file.
2. **ALTER TABLE** sparingly — SQLite limited (np. brak DROP COLUMN before 3.35). Wrangler D1 używa current SQLite, większość ALTER działa.
3. **Indexy** — można dodawać bez breaking change.
4. **CHECK constraints** — można dodać CHECK przez ALTER TABLE (SQLite 3.x).
5. **Cross-migration changes (rare):** użyj single migration z BEGIN/COMMIT (D1 wraps each apply w transaction).

## Backup strategy

Daily R2 export (Faza 5, `cron_runs` job_name='backup_daily'):
```bash
wrangler d1 export mm-control-plane --output /tmp/backup.sql
gzip /tmp/backup.sql
wrangler r2 object put mm-backups/d1/control-plane/$(date +%Y-%m-%d).sql.gz --file /tmp/backup.sql.gz
sha256sum /tmp/backup.sql.gz | wrangler r2 object put mm-backups/d1/control-plane/$(date +%Y-%m-%d).sql.gz.sha256
```

Restore: patrz [ops-restore-from-backup.md](../../../runbooks/ops-restore-from-backup.md).

## Pomocnicze skrypty

- [`.validate.mjs`](.validate.mjs) — apply migracji do in-memory SQLite, report tables/indexes count
- [`.smoke-test.mjs`](.smoke-test.mjs) — apply + 13 sanity insertów z FK/CHECK/CASCADE assertions
- Oba skrypty mają prefix `.` żeby wrangler je ignorował (nie traktował jako migracje)
