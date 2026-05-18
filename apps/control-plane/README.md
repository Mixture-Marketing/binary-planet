# mm-control-plane

Hub: admin dashboard (Astro Server Islands) + Hub API (Hono) + D1 + KV + R2 + Cron Triggers.

**Status:** Track J done — funkcjonalny hub API skeleton. **24/24 testów pass.**

Patrz [plan/J-hub-spoke.md](../../plan/J-hub-spoke.md) i [plan/K-admin-dashboard.md](../../plan/K-admin-dashboard.md).

## Co działa (v0.0.1)

### API routes (Hono)

| Endpoint | Auth | Status | Funkcja |
|----------|------|--------|---------|
| `GET /api/health` | public | ✅ | Health check + DB ping (synthetic monitor target) |
| `POST /api/leads` | `X-BP-Client-Key` | ✅ | Przyjmuje `TransportLead` z Track F; idempotent na `(client_id, client_lead_id)` |
| `POST /api/events` | `X-BP-Client-Key` | ✅ | Spoke analytics events → `audit_log` |
| `GET /api/feature-flags` | `X-BP-Client-Key` | ✅ | Modules + flags per klient z ETag |
| `POST /api/webhooks/stripe` | Stripe signature | ✅ | HMAC verify + replay protection 5min + idempotent insert |
| `POST /api/webhooks/p24` | P24 signature | 🔴 TODO | Faza 3 |
| `POST /api/webhooks/fakturownia` | secret | 🔴 TODO | Faza 3 |
| `POST /api/webhooks/resend` | webhook secret | 🔴 TODO | Faza 5 (dla email tracking) |
| `GET /admin/*` | TBD | placeholder | Astro Server Islands dashboard — Track J2 |

### Middleware

- `requestLogger` — structured JSON logging via `@mixturemarketing/logger`, X-Request-ID propagation
- `authClientKey` — sha256 lookup w `clients.api_key_hash` lub `_new` (rotation grace 7 dni)
- `onError` — globalny handler, sanitizes errors (never leaks stack)
- `notFoundHandler` — standardized 404 JSON

### Repos (data access)

- `repos/clients.ts` — `findClientByApiKeyHash`, `findActiveClientById`, `parseFeatureFlags`
- `repos/leads.ts` — `insertLead` (idempotent on duplicate key)
- `repos/webhook-events.ts` — `recordWebhookReceived` (ON CONFLICT DO NOTHING), `markProcessed`, `markFailed`

### Scheduled handlers (cron triggers)

| Cron | Job | Status | Funkcja |
|------|-----|--------|---------|
| `*/5 * * * *` | `health_check_5min` | ✅ funkcjonalny | Probe primary_domain wszystkich klientów; zapis do `health_checks` |
| `0 2 * * *` | `gsc_daily_pull` | 🔴 stub | TODO Faza 5 |
| `0 3 * * *` | `ga4_daily_pull` | 🔴 stub | TODO Faza 5 |
| `0 4 * * *` | `gbp_daily_pull` | 🔴 stub | TODO Faza 5 |
| `0 5 * * 1` | `dataforseo_weekly` | 🔴 stub | TODO Faza 5 |
| `0 6 * * *` | `backup_daily` | 🟡 placeholder | R2 marker; pełna impl Faza 5 (D1 export via GH Actions) |
| `0 9 * * *` | `daily_digest` | 🔴 stub | TODO Faza 5 |
| `0 0 1 * *` | `monthly_reports` | 🔴 stub | TODO Faza 6 |

Każdy cron loguje run do `cron_runs` table (started/finished/status/items_processed).

## Dev workflow

```bash
# Lokalna baza D1 (CF wrangler dev używa miniflare z lokalnym SQLite)
pnpm --filter @mixturemarketing/mm-control-plane migrations:apply:local
pnpm --filter @mixturemarketing/mm-control-plane dev

# Test
pnpm --filter @mixturemarketing/mm-control-plane test
pnpm --filter @mixturemarketing/mm-control-plane typecheck

# Deploy
pnpm --filter @mixturemarketing/mm-control-plane deploy
```

## Bindings (wrangler.toml)

| Binding | Type | Cel |
|---------|------|-----|
| `DB` | D1 | `mm-control-plane` — 37 tabel z Track C |
| `RATE_LIMIT` | KV | Hub-side throttling |
| `CONFIG` | KV | Kill switches, feature flag cache |
| `DEDUP` | KV | Webhook dedup (TTL 5 min) |
| `BACKUPS` | R2 | `mm-backups` bucket — daily D1 dumps |
| `UPLOADS` | R2 | `mm-uploads` bucket — logo, zdjęcia klientów |

Secrets (`wrangler secret put`): Stripe, P24, Fakturownia, Anthropic, DataForSEO, Resend, SMSAPI, OVH, GH App, Google SA, REGON, JWT, encryption keys — patrz [runbooks/secrets-inventory.md](../../runbooks/secrets-inventory.md) i [wrangler.toml](wrangler.toml).

## Testing

**Strategy:** integration tests z node:sqlite-backed mock D1 (real SQLite, fresh in-memory per test).

- `test/d1-mock.ts` — adapter node:sqlite → D1Database interface
- `test/helpers.ts` — `setupTestEnv()` seeduje 1 active klient z API key
- `test/{health,auth,leads,feature-flags,stripe-webhook}.test.ts` — 24 testy

Pool: `forks` (worker threads nie eksponują `node:sqlite`). Loader: `createRequire` bypass dla Vite optimizer.

Pokrycie:
- **Health** (3): public access, DB check, X-Request-ID
- **Auth** (6): missing key, invalid key, short key, valid key, suspended klient, rotated key grace
- **Leads** (7): 201 fresh insert, 200 idempotent replay, validation error, missing consent, client_id mismatch, retention DEFAULT fired, invalid JSON
- **Feature flags** (3): payload shape, ETag header, 304 conditional GET
- **Stripe** (5): valid sig + dispatch, invalid sig 401, stale timestamp replay protection, missing header 400, idempotency dedup

## Limity v0.0.1

**NIE jest jeszcze:**
- Astro UI dashboard (`/admin` ma tylko placeholder HTML)
- P24/Fakturownia/Resend webhooks
- GSC/GA4/GBP/DataForSEO cron implementations (tylko stubs)
- Drain cron dla spoke fallback queues (logika w `web-core/forms/fallback-queue.ts`, ale per-spoke iteration w hub TODO)
- Provisioning workflow (Stripe webhook tylko loguje, nie tworzy klienta) — Faza 3
- Per-tenant D1 encryption key resolution (interface gotowy, env var nie dostarczana)

## Reference

- [plan/J-hub-spoke.md](../../plan/J-hub-spoke.md) — architektura
- [plan/K-admin-dashboard.md](../../plan/K-admin-dashboard.md) — admin UI spec (Track J2)
- [plan/E-d1-schemas-billing.md](../../plan/E-d1-schemas-billing.md) — D1 schema design
- [migrations/](migrations/) — Track C D1 schema (37 tabel)
- [runbooks/](../../runbooks/) — incident procedures
