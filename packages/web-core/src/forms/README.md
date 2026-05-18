# @mixturemarketing/web-core/forms

Form handler dla stron klientów (spoke). Track F done.

Pipeline:

```
POST /api/contact (klient site)
  → validate (zod, RODO consent required)
  → honeypot check
  → rate limit (KV: per IP + per email_hash)
  → Turnstile verify (if configured)
  → render consent text + hash (audit evidence)
  → build TransportLead (hash PII, AES-GCM encrypt if key provided)
  → parallel: hub sync (3s timeout) + Resend email forward
  → if hub fails retriably: enqueue to KV fallback queue
  → return 200 with friendly message
```

**Zero data loss design:** klient zawsze dostaje email przez Resend (primary channel) +
lead trafia do hub (lub fallback queue jeśli hub down). Drain cron (Faza 3) odzyskuje queue.

## Quick start

```ts
import { createFormHandler } from "@mixturemarketing/web-core/forms";

export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname === "/api/contact") {
      const handler = createFormHandler({
        env,
        config: {
          clientId: "clk_kowalski",
          businessName: "Ślusarz Kowalski",
          notificationEmail: "kowalski@example.pl",
          primaryDomain: "kowalski-slusarz.pl",
          consentTextVersion: "v1.0",
          // optional overrides:
          rateLimit: { submitsPerEmail: 3, submitsPerIp: 5, windowSec: 3600 },
          hub: { timeoutMs: 3000, maxRetries: 1 },
        },
      });
      return handler(request);
    }
    return new Response("not found", { status: 404 });
  },
};
```

`env` (Worker bindings, must define):
- `RATE_LIMIT: KVNamespace` — rate limit storage
- `FALLBACK_QUEUE: KVNamespace` — fallback queue storage
- `BP_CLIENT_API_KEY: string` — spoke → hub auth
- `RESEND_API_KEY: string`, `RESEND_FROM: string` — email forward
- `TURNSTILE_SECRET: string` — anti-bot (optional)
- `PII_ENCRYPTION_KEY_B64: string` — AES-GCM key (optional; if absent, hash-only)
- `HUB_BASE_URL: string` — defaults to `https://api.mixturemarketing.pl`

## Status codes

| HTTP | Meaning | When |
|------|---------|------|
| 200 | Success | Hub accepted OR fallback queue used (klient still gets email) |
| 400 | Validation error | Invalid email, missing consent, malformed JSON, missing turnstile token |
| 403 | Turnstile failed | Token verification rejected |
| 405 | Method not allowed | Not POST |
| 429 | Rate limited | IP or email hit submit threshold |

## Module map

| File | Scope | Tests |
|------|-------|-------|
| [`handler.ts`](handler.ts) | Orchestrator — `createFormHandler({env, config}) => fetch handler` | 13 integration |
| [`types.ts`](types.ts) | `FormHandlerEnv`, `FormHandlerConfig`, `TransportLead`, `ValidatedLead`, `SubmitOutcome` | — |
| [`validation.ts`](validation.ts) | Zod schema for lead input + PL phone regex + honeypot | 13 unit |
| [`rodo.ts`](rodo.ts) | Versioned consent templates (v1.0) + canonical hash for audit | 8 unit |
| [`pii.ts`](pii.ts) | sha256 hash + AES-GCM encrypt/decrypt + email/phone normalize | 13 unit |
| [`turnstile.ts`](turnstile.ts) | CF Turnstile verify with 3s timeout | (integration) |
| [`rate-limit.ts`](rate-limit.ts) | KV sliding-window per IP + email | 5 unit |
| [`hub-sync.ts`](hub-sync.ts) | POST to hub w retry + AbortController timeout | 6 unit |
| [`fallback-queue.ts`](fallback-queue.ts) | KV queue enqueue/drain with exponential abandon (24h) | 5 unit |
| [`resend.ts`](resend.ts) | Email forward to klient (PL templated HTML+text) | (integration) |
| `index.ts` | Public exports | — |

**Total: 12 source files, ~1100 linii kodu + 6 test files, ~500 linii testów. 73 testów dla `/forms` (z 130 total w web-core).**

## RODO compliance

- **Consent versioned + hashed** — każdy lead zachowuje `consent_text_version` + sha256 zobaczonej treści (audit Art. 7)
- **PII encryption optional** — AES-GCM-256 per-tenant key (env `PII_ENCRYPTION_KEY_B64`). Bez key: hash-only (D1 `*_enc` columns NULL)
- **Email + phone normalized** przed hashowaniem (deterministic dedup)
- **IP hashed not stored plaintext** — `consent_ip_hash` evidence Art. 7
- **24-month retention** — D1 `delete_after` DEFAULT (patrz [0003_leads.sql](../../../../apps/control-plane/migrations/0003_leads.sql))

## Fallback queue (J.4)

Gdy hub odpowiada 5xx lub timeout >3s:
1. Lead trafia do `FALLBACK_QUEUE` KV pod kluczem `leadq:<clientId>:<priority>:<ts>:<id>`
2. Klient nadal dostaje email przez Resend (backup channel)
3. Drain cron (Faza 3, every 5 min) tries each item — exponential backoff on failure
4. Po 288 prób (24h) — lead abandoned + critical alert P1

Tests cover all four scenarios: hub 200, hub 5xx, hub timeout, hub 4xx (non-retriable).

## Reference

- Plan: [00-main.md "Faza 1 #6"](../../../../plan/00-main.md)
- Plan: [J-hub-spoke.md J.4 failure modes](../../../../plan/J-hub-spoke.md)
- Plan: [A-rodo.md A.2 consent](../../../../plan/A-rodo.md)
- Plan: [I-analytics.md I.2 Consent Mode v2](../../../../plan/I-analytics.md)
- D1 schema: [0003_leads.sql](../../../../apps/control-plane/migrations/0003_leads.sql) (target shape of `TransportLead` after hub ingestion)
- Runbook: [P1-lead-form-broken.md](../../../../runbooks/P1-lead-form-broken.md)
