# @mixturemarketing/web-core/feature-flags

Per-klient feature flags + budget caps + global kill switches.

**Status:** Track Feature Flags done. 5 source + 3 test files, 25 testów.

## Resolution order (highest wins)

1. **Hub override** — D1 `feature_flag_overrides` table (admin force-flag z TTL)
2. **Kill switches** — `CONFIG` KV (global, instant — `MAINTENANCE_MODE`, `AI_KILL_SWITCH`, ...)
3. **Client config** — compiled into spoke build (`client.config.ts.modules[]`)
4. **Tier defaults** — `TIER_DEFAULT_MODULES[tier]`

## Quick start (spoke Worker)

```ts
import { createFeatureFlagClient } from "@mixturemarketing/web-core/feature-flags";

const ff = createFeatureFlagClient({
  config: {
    clientId: "clk_kowalski",
    tier: "premium",
    baseConfig: {
      modules: ["care", "reputation"],
      budgets: { ai_monthly_usd: 50 },
      flags: { custom_threshold: 42 },
    },
  },
  hubBaseUrl: env.HUB_BASE_URL,
  hubApiKey: env.BP_CLIENT_API_KEY,
  cacheKv: env.CONFIG,           // 5-min cache
  killSwitchKv: env.CONFIG,      // shared with kill switches
});

// Use:
if (await ff.isModuleEnabled("ai_blog")) {
  await generateBlogPost(...);
}

const cap = await ff.getBudget("ai_monthly_usd");
if (cap !== undefined && currentSpend >= cap) {
  return { skipped: true, reason: "budget_exceeded" };
}

const customFlag = await ff.getFlag<number>("custom_threshold");
```

## Known modules

```
care, local_basic                            — tier starter
care, local_basic, reputation,
citation_basic, monthly_reports              — tier standard
+ ai_blog, citation_premium,
  gbp_auto_post, panel_klienta               — tier premium
+ google_ads_managed, meta_ads_managed,
  multi_location, geo_ai_optimization        — premium add-ons
```

## Kill switches (global)

| Switch | Effect |
|--------|--------|
| `MAINTENANCE_MODE` | Spoke buforuje wszystkie writes do fallback queue |
| `AI_KILL_SWITCH` | Brak wywołań Anthropic (cost spike circuit breaker) |
| `FORMS_KILL_SWITCH` | Submisje form disabled (breach response) |
| `WEBHOOKS_KILL_SWITCH` | Stop processing Stripe/P24 webhooks |

Toggle via D1 admin OR direct KV write:
```bash
wrangler kv:key put kill:AI_KILL_SWITCH "true" --binding CONFIG
```

## Budget caps

```ts
import { checkBudget, aiSpendThisMonthQuery } from "@mixturemarketing/web-core/feature-flags";

const r = await checkBudget({
  clientId: "clk_abc",
  category: "ai_monthly_usd",
  cap: 50,
  fetchSpent: aiSpendThisMonthQuery(env.DB, "clk_abc"),
});
if (r.exceeded) return earlyReturn();
```

Categories: `ai_monthly_usd`, `sms_monthly_pln`, `ads_monthly_pln`, `datataforseo_monthly_usd`.

## Reference

- Plan: [J-hub-spoke.md /api/feature-flags](../../../../plan/J-hub-spoke.md)
- mm-control-plane: [/api/feature-flags](../../../../apps/control-plane/src/api/routes/feature-flags.ts) — hub endpoint
- D1: [0009_integrations.sql feature_flag_overrides](../../../../apps/control-plane/migrations/0009_integrations.sql)
- Runbook: [P2-anthropic-rate-limit.md](../../../../runbooks/P2-anthropic-rate-limit.md) — AI_KILL_SWITCH usage
