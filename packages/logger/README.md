# @mixturemarketing/logger

Structured JSON logging dla Cloudflare Workers. Output trafia do `console.log/warn/error` → captured by CF Logpush → R2 parquet (filter `level >= 'warn'`).

**Status:** v0.0.1 — działający (jedyny moduł v0.1 z faktyczną implementacją w Track B).

## Użycie

```ts
import { Logger, getRequestId } from "@mixturemarketing/logger";

// W handlerze:
const log = new Logger({
  requestId: getRequestId(request.headers),
  clientId: "clk_abc123",
  module: "forms",
  workerName: "mm-client-clk_abc123",
});

log.info("lead submitted", { leadId, source: "contact-form" });
log.warn("turnstile fallback used", { ip });
log.error("hub sync failed", err, { attempt: 3 });
log.critical("d1 integrity check failed", err); // P1 alert
```

## Hono middleware (przykład, dorzuć do swojego handlera)

```ts
import { Logger, getRequestId } from "@mixturemarketing/logger";
import type { MiddlewareHandler } from "hono";

export const loggerMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = getRequestId(c.req.raw.headers);
  c.set("logger", new Logger({ requestId, workerName: c.env.WORKER_NAME }));
  c.res.headers.set("X-Request-ID", requestId);
  await next();
};

// W handlerach:
app.post("/api/contact", (c) => {
  const log = c.get("logger");
  log.info("contact form hit");
  ...
});
```

## Format outputu

Każdy log = jedna linia JSON:

```json
{
  "timestamp": "2026-05-18T14:23:11.234Z",
  "level": "info",
  "message": "lead submitted",
  "requestId": "req-abc",
  "clientId": "clk_xyz",
  "module": "forms",
  "workerName": "mm-client-clk_xyz",
  "data": { "leadId": "lead_123", "source": "contact-form" }
}
```

## Levels

| Level | console method | Logpush captured | Alert? |
|-------|----------------|------------------|--------|
| `debug` | log | NO (filter cut) | NO |
| `info` | log | NO | NO |
| `warn` | warn | YES | NO |
| `error` | error | YES | P2 if rate >5% |
| `critical` | error | YES | **P1 always** |

## Convention

- Każdy log MUSI mieć `requestId` (dla tracing)
- `clientId` zawsze gdy operacja per-klient
- `module` = subpath web-core lub semantic group (`forms`, `leads`, `billing`, `cron`)
- `data` — strukturalne pola, NIE conkatenuj w `message` (parsowanie później)
- PII (email, telefon) — hashuj zanim trafi do `data` (np. `email_hash: sha256(email)`)

## Reference

Plan: [W-12-dni-operacyjnych.md W.3.1](../../plan/W-12-dni-operacyjnych.md).
