# APPENDIX W — 12 dni operacyjnych w Fazie 0-1 (operations track)

DevOps re-review verdict: "Te 12 dni — nienegocjowalne przed klientem #1." Wbudowuję jako równoległy track do tech buildu.

## W.1 Tydzień 1 Fazy 0: Runbook + Severity Matrix (3 dni)

### W.1.1 Severity Matrix

```yaml
# .claude/runbooks/severity-matrix.md
P1 - CRITICAL (response 15 min, fix 1h):
  - Klient site offline >5 min
  - Lead form not submitting (data loss risk)
  - Stripe webhook failures (revenue impact)
  - Database corruption / data loss

P2 - HIGH (response 1h, fix 24h):
  - GBP API failures (review monitoring broken)
  - CWV degradation > tier threshold
  - SSL expiry < 7 dni
  - Anthropic API >5% error rate
  - Single client deploy failure

P3 - MEDIUM (response 24h, fix 7 dni):
  - Sveltia CMS bugs
  - Dashboard widget errors
  - Citation submission failures (1 dyrektory)
  - Email delivery delays

P4 - LOW (response 7 dni, fix backlog):
  - UI polishing
  - Documentation gaps
  - Feature requests
```

### W.1.2 Runbook directory

`binary-planet-control-plane/runbooks/`:
```
runbooks/
├── README.md                       (index, jak używać)
├── P1-client-site-offline.md       (procedura step-by-step)
├── P1-lead-form-broken.md
├── P1-stripe-webhook-failure.md
├── P1-d1-corruption.md
├── P2-gbp-api-down.md
├── P2-ssl-expiry-imminent.md
├── P2-anthropic-rate-limit.md
├── P3-sveltia-bug.md
├── ops-deploy-fleet-update.md
├── ops-onboard-new-client.md
├── ops-rotate-secrets.md
├── ops-restore-from-backup.md
└── ops-handoff-to-va.md
```

Każdy runbook zawiera:
- Symptoms (jak to wygląda w panelu/alercie)
- Impact (kto dotknięty, co stoi)
- Diagnostic commands (gotowe do skopiowania)
- Resolution steps
- Verification
- Postmortem template

### W.1.3 Alert routing

```typescript
// control-plane/src/alerting/router.ts
const alertRoutes = {
  P1: ['sms:jakub_phone', 'email:jakub', 'slack:critical'],
  P2: ['email:jakub', 'slack:ops'],
  P3: ['email:digest', 'slack:ops'],  // digest = daily summary
  P4: ['slack:ops'],
};

// On-call discipline:
// - W tygodniu: P1 reagujesz w 15 min
// - Weekend: P1 reagujesz w 30 min
// - PTO: VA na call, P1 → SMS + email do VA + jakuba
// - Sleep mode (23:00-07:00): P1 → tylko SMS, reszta digest rano
```

## W.2 Tydzień 1 Fazy 1: Secret Rotation Pipeline + Inventory (4 dni)

### W.2.1 D1 schema

```sql
CREATE TABLE secrets_inventory (
  id TEXT PRIMARY KEY,
  client_id TEXT REFERENCES clients(id),
  secret_type TEXT NOT NULL,         -- 'resend_api_key', 'gbp_oauth_refresh', 'turnstile_secret', etc.
  worker_name TEXT NOT NULL,
  current_version INTEGER NOT NULL,
  kid TEXT NOT NULL,                 -- key identifier dla rotacji
  created_at TEXT NOT NULL,
  rotated_at TEXT,
  expires_at TEXT,
  rotation_policy TEXT NOT NULL,     -- 'quarterly', 'semi-annual', 'on-demand'
  status TEXT NOT NULL               -- 'active', 'pending_rotation', 'expired', 'revoked'
);

CREATE TABLE secret_rotation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  secret_id TEXT NOT NULL REFERENCES secrets_inventory(id),
  rotated_at TEXT NOT NULL,
  rotated_by TEXT NOT NULL,          -- 'system', 'admin:jakub'
  reason TEXT NOT NULL,              -- 'scheduled', 'incident', 'employee_offboarding', 'compromise'
  old_kid TEXT,
  new_kid TEXT,
  grace_period_until TEXT            -- 7 dni overlap dla rolling rotation
);
```

### W.2.2 Rotation cron (CF Workers Scheduled)

```typescript
// Weekly cron sprawdza secrets_inventory
async function checkRotationNeeded() {
  const expiringSoon = await db.all(`
    SELECT * FROM secrets_inventory 
    WHERE status = 'active' 
      AND expires_at < datetime('now', '+30 days')
  `);
  
  for (const secret of expiringSoon) {
    await db.run(`UPDATE secrets_inventory SET status = 'pending_rotation' WHERE id = ?`, secret.id);
    await sendAlert('P2', `Secret rotation needed: ${secret.client_id}/${secret.secret_type}`);
  }
}

// Manual rotation trigger (admin action)
async function rotateSecret(secretId: string) {
  const secret = await db.get(`SELECT * FROM secrets_inventory WHERE id = ?`, secretId);
  const newValue = generateSecret(secret.secret_type);
  const newKid = generateKid();
  
  // Step 1: deploy new secret as v(N+1) with old secret still active (grace period)
  await wrangler.secret.put(secret.worker_name, `${secret.secret_type}_NEW`, newValue);
  
  // Step 2: switch app to use new secret
  await wrangler.deploy(secret.worker_name);
  
  // Step 3: wait 7 dni grace period, monitor
  await db.run(`
    UPDATE secrets_inventory 
    SET current_version = current_version + 1, kid = ?, rotated_at = datetime('now'), status = 'active'
    WHERE id = ?
  `, [newKid, secretId]);
  
  await db.run(`INSERT INTO secret_rotation_log (...)`);
  
  // Step 4: after 7 dni, remove old secret
  await scheduleTask('remove_old_secret', { secretId, oldKid: secret.kid }, 7 * 24 * 3600);
}
```

### W.2.3 Quarterly rotation polityka

- **Shared secrets** (Anthropic, DataForSEO, Resend, SMSAPI) — kwartalna rotacja
- **Per-client secrets** (Resend per-client domain, GBP OAuth) — semi-annual
- **API keys spoke→hub** (`BP_CLIENT_API_KEY`) — kwartalna LUB on-demand (jeśli klient się skarży)
- **JWT signing keys** (panel klienta) — semi-annual z key versioning
- **Stripe webhook secret** — on-demand (rzadko, tylko jeśli compromise)

## W.3 Tydzień 2 Fazy 1: Observability MVP (5 dni)

### W.3.1 `@binary-planet/logger`

```typescript
// @binary-planet/logger/index.ts
export interface LogContext {
  requestId: string;
  clientId?: string;
  userId?: string;
  module?: string;
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical';
}

export class Logger {
  constructor(private ctx: LogContext) {}
  
  log(level: string, message: string, data?: object) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      requestId: this.ctx.requestId,
      clientId: this.ctx.clientId,
      module: this.ctx.module,
      message,
      data,
    };
    console.log(JSON.stringify(entry));  // Captured by Logpush
  }
  
  // Helper methods
  info(msg: string, data?: object) { this.log('info', msg, data); }
  warn(msg: string, data?: object) { this.log('warn', msg, data); }
  error(msg: string, error?: Error, data?: object) {
    this.log('error', msg, { ...data, error: error?.stack });
  }
}

// Middleware (Hono)
export const loggerMiddleware = (c, next) => {
  const requestId = c.req.headers.get('X-Request-ID') || crypto.randomUUID();
  c.set('logger', new Logger({ requestId, severity: 'info' }));
  c.res.headers.set('X-Request-ID', requestId);
  return next();
};
```

### W.3.2 Logpush configuration

```toml
# control-plane/wrangler.toml
[[logpush]]
dataset = "workers_trace_events"
destination = "r2://bp-logs/year=YYYY/month=MM/day=DD/"
output_options = "format=parquet,timestamp_format=unix"
filter = "level >= 'warn'"  # only warn/error/critical
```

### W.3.3 Synthetic monitor (zamiast Better Stack)

```typescript
// control-plane/src/scheduled/synthetic-monitor.ts
// Runs every 5 minutes
export default {
  async scheduled(event: ScheduledEvent, env: Env) {
    const clients = await env.DB.prepare(
      `SELECT id, primary_domain FROM clients WHERE status = 'active'`
    ).all<Client>();
    
    const results = await Promise.allSettled(
      clients.map(async (client) => {
        const start = Date.now();
        const response = await fetch(`https://${client.primary_domain}/`);
        const elapsed = Date.now() - start;
        
        await env.DB.prepare(`
          INSERT INTO health_checks (client_id, checked_at, http_status, response_time_ms, uptime)
          VALUES (?, datetime('now'), ?, ?, ?)
        `).bind(client.id, response.status, elapsed, response.ok).run();
        
        if (!response.ok || elapsed > 3000) {
          await sendAlert('P1', `Client ${client.id} health check failed: status=${response.status}, time=${elapsed}ms`);
        }
        
        return { clientId: client.id, ok: response.ok, elapsed };
      })
    );
    
    // Aggregate metrics → Analytics Engine
    await env.ANALYTICS.writeDataPoint({
      blobs: ['health_check_batch'],
      doubles: [results.filter(r => r.status === 'fulfilled' && r.value.ok).length / clients.length],
      indexes: ['daily']
    });
  }
};
```

Skaluje do 1000+ klientów za $5/mc CF Workers Paid (nie potrzeba Better Stack).

---
