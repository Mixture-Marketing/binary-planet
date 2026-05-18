# P2: Anthropic API rate limit / error rate >5%

**Severity:** P2 — HIGH
**Response SLA:** 1h
**Fix SLA:** 24h
**Last updated:** 2026-05-18

## Symptoms

- Alert `anthropic_error_rate > 5%` (last 10 min)
- Blog draft generation (Faza 7) fail dla wielu klientów jednocześnie
- AI content generation w onboarding wizard timeout
- 429 errors w logach: `Rate limit exceeded`, `Concurrent request limit`
- 529 errors: `Anthropic overloaded` (ich problem, nie nasz)
- Spike w invoice Anthropic — usage explosion (potencjalny abuse)

## Impact

- **Onboarding broken** (jeśli AI fail przy wizardzie) — klient nie kończy zakupu
- **Blog generation delayed** (Premium tier value prop osłabiona)
- **Review responses opóźnione** (AI suggester w dashboard)
- **Koszty:** spike może przekroczyć $200/mc cap (ustalony w preflight)

## Diagnostic commands

```bash
# 1. Sprawdź Anthropic status
# Manualnie: status.anthropic.com

# 2. Sprawdź current usage / billing
# Manualnie: console.anthropic.com → Usage → last 7 days
# Sprawdź też: "Tier" (Tier 1/2/3 — rate limits różne)

# 3. Sprawdź logi control plane
wrangler tail mm-control-plane --format pretty | grep -i "anthropic\|claude\|429\|529"

# 4. D1 — które klienty/jobs failują
wrangler d1 execute mm-control-plane --command \
  "SELECT job_name, COUNT(*), MIN(error) FROM job_runs WHERE error LIKE '%anthropic%' AND created_at > datetime('now', '-1 hour') GROUP BY job_name"

# 5. Sprawdź czy ktoś abuses
# (Jeśli nasz endpoint AI dla klientów jest publiczny — checks na rate limit per klient)
wrangler d1 execute mm-control-plane --command \
  "SELECT client_id, COUNT(*) FROM ai_calls WHERE created_at > datetime('now', '-1 hour') GROUP BY client_id ORDER BY 2 DESC LIMIT 10"
```

## Resolution steps

### Scenario A — Anthropic overloaded (529)

```bash
# Ich problem. Action:
# 1. Czekać na resolve (zwykle <30 min)
# 2. Cron retry z exponential backoff — automatyczne
# 3. Jeśli onboarding affected — banner w wizardzie "AI temporary delay, please retry"
# 4. Blog drafts: queue do retry później
```

### Scenario B — Rate limit (429) — my przekraczamy nasz tier

```bash
# 1. Sprawdź concurrent request burst
# Logi: ile req/sec wysłaliśmy

# 2. Krótkoterminowo: throttle w kodzie
# Jeśli wszystkie joby palą się od razu po deployu — dodaj jitter
# Lokalizacja: mm-control-plane/src/lib/anthropic-client.ts (Faza 1)

# 3. Długoterminowo: upgrade tier
# Manualnie: console.anthropic.com → Settings → Plans
# Tier 1 → Tier 2 wymaga $40 prepaid + 7 dni history
```

### Scenario C — Cost spike (usage > $200 cap)

```bash
# 1. Identify root cause
# Najczęściej: prompt injection / loop w kliencie który wzywa AI w pętli

# 2. Krótkoterminowo: kill switch
wrangler kv:key put AI_KILL_SWITCH "true" --binding CONFIG --env production
# Spoke + control plane checks ten flag przed Anthropic call

# 3. Audit — który klient/job zużywa najwięcej
wrangler d1 execute mm-control-plane --command \
  "SELECT client_id, SUM(input_tokens + output_tokens) AS total_tokens, SUM(cost_usd) AS total_cost
   FROM ai_calls 
   WHERE created_at > datetime('now', '-24 hours') 
   GROUP BY client_id ORDER BY total_cost DESC LIMIT 10"

# 4. Hard cap per klient
# Update D1: clients.feature_flags.ai_monthly_budget_usd = X
# Spoke checks budget przed call

# 5. Re-enable AI tylko dla klientów z OK usage
wrangler kv:key delete AI_KILL_SWITCH --binding CONFIG --env production
```

### Scenario D — Klient abuse (programmatic prompt injection)

```bash
# Jeśli klient odkrył endpoint AI i wzywa go z dziwnymi promptami:

# 1. Identify w logach
wrangler tail mm-control-plane --format pretty | grep "ai_call.*<CLIENT_ID>"

# 2. Per-client rate limit w KV
wrangler kv:key put RATE_LIMIT_AI_<CLIENT_ID> "100" --binding RATE_LIMIT
# 100 calls/dzień, reset cron daily

# 3. Audit prompty — czy to przypadek czy intencja
# Jeśli intencja: email do klienta + warning, escalation do terminate jeśli persist
```

### Scenario E — API key compromised

```bash
# Rotacja natychmiastowa — patrz [ops-rotate-secrets.md](ops-rotate-secrets.md) sekcja Anthropic

# 1. Generate new key w console.anthropic.com
# 2. wrangler secret put ANTHROPIC_API_KEY (production + staging)
# 3. wrangler deploy
# 4. Revoke old key w console
# 5. Audit usage od momentu compromise
```

## Verification

```bash
# 1. Error rate <1% w ostatnich 15 min
# Dashboard: dashboard.mixturemarketing.pl/operations/api-quotas

# 2. Test AI call manualnie
# TODO: po Faza 1
curl -X POST https://api.mixturemarketing.pl/api/ai/test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"prompt":"runbook test","max_tokens":50}'

# 3. Stuck jobs unblock
wrangler d1 execute mm-control-plane --command \
  "UPDATE job_runs SET status = 'retry' WHERE status = 'failed' AND error LIKE '%anthropic%'"
```

## Cost monitoring (prewencja)

- **Cron daily 09:00:** raport Anthropic spend ostatnie 24h → email Jakubowi
- **Alert P3:** spend >$50/dzień (200% normalnego baseline)
- **Alert P2:** spend >$100/dzień
- **Auto kill switch:** spend >$150/dzień

## Common causes

*(Pusta)*
