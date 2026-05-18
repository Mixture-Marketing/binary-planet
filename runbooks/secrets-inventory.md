# Secrets Inventory & Rotation Policy

Pełna lista wszystkich sekretów + polityka rotacji + procedura. Live state w D1 `secrets_inventory` (Faza 1).

## Zasady ogólne

1. **NIGDY commit do gita** — używamy `wrangler secret put` lub GitHub Actions secrets
2. **NIGDY w plain text na maila** — jeśli musisz przesłać, użyj 1Password share / Bitwarden Send (24h TTL)
3. **Rotation = rolling** — 7-dniowy grace period z dwiema wersjami aktywnymi (versioned KIDs)
4. **Każda rotacja logowana** — `secret_rotation_log` w D1, kto/kiedy/dlaczego
5. **Compromise = on-demand** — natychmiastowa rotacja + audit + powiadomienie klientów dotkniętych

## Inventory — pełna lista

### Hub / Control plane secrets

| Secret | Provider | Rotation | Owner | Notes |
|--------|----------|----------|-------|-------|
| `ANTHROPIC_API_KEY` | Anthropic | Quarterly | Jakub | Production key, $200/mc cap |
| `DATAFORSEO_LOGIN` + `_PASSWORD` | DataForSEO | Quarterly | Jakub | Basic plan |
| `RESEND_API_KEY` | Resend.com | Quarterly | Jakub | Domain `mixturemarketing.pl` |
| `SMSAPI_TOKEN` | SMSAPI.pl | Quarterly | Jakub | Prepaid |
| `STRIPE_SECRET_KEY` | Stripe | Semi-annual | Jakub | Live mode |
| `STRIPE_WEBHOOK_SECRET` | Stripe | On-demand | Jakub | Per endpoint |
| `P24_MERCHANT_ID` + `P24_CRC_KEY` + `P24_API_KEY` | Przelewy24 | Semi-annual | Jakub | |
| `FAKTUROWNIA_API_TOKEN` | Fakturownia | Semi-annual | Jakub | |
| `REGON_USER_KEY` | GUS BIR1 | On-demand | Jakub | Tylko jeśli compromise (rzadko) |
| `OVH_APP_KEY` + `OVH_APP_SECRET` + `OVH_CONSUMER_KEY` | OVHcloud | Quarterly | Jakub | Dla domain registration |
| `CF_API_TOKEN` (control plane → CF API) | Cloudflare | Quarterly | Jakub | Scoped: Workers, DNS, R2, D1, KV |
| `GH_APP_PRIVATE_KEY` | GitHub App | Semi-annual | Jakub | Dla auto-provisioning repo per klient |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud | Annual | Jakub | GBP + GSC + GA4, jeden SA dla wszystkich |
| `BETTER_STACK_HEARTBEAT_URL` | Better Stack | On-demand | Jakub | Public URL, ale change rotuj jeśli leak |
| `TURNSTILE_SECRET_KEY` | Cloudflare | Quarterly | Jakub | Anti-spam dla formów |
| `JWT_SIGNING_KEY` (panel klienta) | Self-generated | Semi-annual | Jakub | Key versioning z kid |
| `D1_ENCRYPTION_KEY` (per-tenant PII) | Self-generated | Annual + rotate per breach | Jakub | KMS-style key wrapping |

### Per-client spoke secrets

| Secret | Provider | Rotation | Owner | Notes |
|--------|----------|----------|-------|-------|
| `BP_CLIENT_API_KEY` (spoke → hub) | Self-generated | Quarterly | System cron | Per klient, `ck_live_<random>` |
| `RESEND_API_KEY_<CLIENT>` | Resend (per-domain) | Semi-annual | System cron | Tylko jeśli klient ma własny domain DKIM |
| `TURNSTILE_SECRET_<CLIENT>` | Cloudflare | Quarterly | System cron | Per spoke Worker |
| `GBP_OAUTH_REFRESH_<CLIENT>` | Google | Semi-annual + Google policy 6mc | System cron | Jeśli ścieżka B (OAuth) nie A (Service Account) |
| `STRIPE_CUSTOMER_<CLIENT>` | Stripe | N/A (immutable ID) | — | Identyfikator, nie sekret per se |

### Backup / disaster

| Secret | Provider | Rotation | Owner | Notes |
|--------|----------|----------|-------|-------|
| `VERCEL_DEPLOY_TOKEN` (standby) | Vercel | Quarterly | Jakub | DR fallback (O.2) |
| `CF_R2_BACKUP_BUCKET_TOKEN` | Cloudflare | Quarterly | Jakub | R2 backup writes |
| `BACKUP_ENCRYPTION_KEY` | Self-generated | Annual | Jakub | AES-256 dla R2 snapshots |

## Rotation policy szczegółowo

### Quarterly (co 3 mc)

**Cel:** redukcja blast radius przy compromise (max 3 mc exposure).

**Schedule:** 1. dzień Q1/Q2/Q3/Q4 — cron `0 9 1 1,4,7,10 *` (control plane)

**Sekrety:** Anthropic, DataForSEO, Resend, SMSAPI, OVH, CF, Turnstile, BP_CLIENT_API_KEY (per klient)

**Procedura:** [ops-rotate-secrets.md](ops-rotate-secrets.md)

### Semi-annual (co 6 mc)

**Cel:** sekrety o niższym ryzyku LUB długim grace period (key versioning).

**Schedule:** 1. stycznia + 1. lipca

**Sekrety:** Stripe, P24, Fakturownia, GitHub App, JWT signing, GBP OAuth (per Google policy)

### Annual

**Sekrety:** Google Service Account JSON, D1 encryption key, backup encryption key

### On-demand

**Trigger:** podejrzenie compromise, employee/VA offboarding, klient się skarży na anomalie

**Sekrety:** Stripe webhook, REGON, JWT (jeśli session leak)

## Compromise scenarios

| Scenario | Action |
|----------|--------|
| Laptop Jakuba zaginiony/skradziony | Wszystkie sekrety w 24h rotacja, audit log access od momentu kradzieży, change passwords ze wszystkich SaaS |
| API key leak w gicie public | Natychmiast: revoke + rotate, GitHub secret scanning ticket, audit log API usage |
| Klient zgłasza nietypową aktywność | Rotacja jego BP_CLIENT_API_KEY + audit log spoke → hub przez 90 dni |
| Phishing — Jakub kliknął | Wszystkie 2FA reset, rotacja sekretów, audit log SaaS dashboards |
| VA offboarding (Faza 8+) | Wszystkie sekrety do których miała dostęp: rotacja w 1h, audit |

## Storage

- **Production:** CF Workers secrets (encrypted at rest by Cloudflare)
- **D1 inventory metadata:** TYLKO metadata (typ, kid, expires_at) — nie wartości
- **Local dev:** `.dev.vars` w `.gitignore`, każdy programista (na razie tylko Jakub) ma własny set test keys
- **Master password manager:** 1Password Business lub Bitwarden Premium — wszystkie sekrety w jednym vault, 2FA z hardware key (YubiKey rekomendowane)

## Pre-launch checklist

- [ ] 1Password / Bitwarden vault założony, 2FA z hardware key
- [ ] Wszystkie SaaS dashboards z 2FA enabled (Anthropic, DataForSEO, Resend, SMSAPI, Stripe, P24, OVH, Cloudflare, GitHub)
- [ ] CF API token z minimalnym scope (nie Global API Key)
- [ ] GitHub App nie OAuth user token
- [ ] D1 schema `secrets_inventory` + `secret_rotation_log` (Faza 1)
- [ ] Cron rotacji aktywny (Faza 1)
- [ ] Backup contact zna procedurę awaryjną (kto może wykonać emergency rotation jeśli Jakub niedostępny)

## Update log

- **2026-05-18** — pierwsza wersja, oparta na [W.2 + W.2.3](../plan/W-12-dni-operacyjnych.md)
