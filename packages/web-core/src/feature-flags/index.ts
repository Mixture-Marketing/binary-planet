/**
 * @mixturemarketing/web-core/feature-flags
 *
 * Per-klient feature flags resolved from:
 *   1. Hub override (D1 feature_flag_overrides — admin force-flag, TTL)
 *   2. Kill switches (CONFIG KV — global, instant)
 *   3. Client config (compiled into spoke build)
 *   4. Tier defaults
 *
 * Plus per-klient budget caps + global kill switches.
 *
 * Reference: plan/00-main.md (Faza 1), plan/J-hub-spoke.md (/api/feature-flags endpoint).
 *
 * Quick start (spoke Worker):
 *   import { createFeatureFlagClient } from "@mixturemarketing/web-core/feature-flags";
 *
 *   const ff = createFeatureFlagClient({
 *     config: { clientId: "clk_abc", tier: "premium", baseConfig: { modules: ["care"] } },
 *     hubBaseUrl: env.HUB_BASE_URL,
 *     hubApiKey: env.BP_CLIENT_API_KEY,
 *     cacheKv: env.CONFIG,
 *     killSwitchKv: env.CONFIG,
 *   });
 *
 *   if (await ff.isModuleEnabled("ai_blog")) { ... }
 *   if (await ff.getBudget("ai_monthly_usd") < currentSpend) { ... }
 */

export const MODULE_NAME = "feature-flags" as const;

// Client
export { createFeatureFlagClient } from "./client.js";
export type { FeatureFlagClient, FeatureFlagClientDeps } from "./client.js";

// Kill switches
export {
  getActiveKillSwitches,
  isKillSwitchActive,
  setKillSwitch,
} from "./kill-switches.js";
export type { KillSwitchDeps } from "./kill-switches.js";

// Budget
export { aiSpendThisMonthQuery, checkBudget, smsSpendThisMonthQuery } from "./budget.js";
export type { BudgetCheckInput, BudgetCheckResult } from "./budget.js";

// Types
export {
  BUDGET_CATEGORIES,
  KILL_SWITCHES,
  KNOWN_MODULES,
  TIER_DEFAULT_MODULES,
} from "./types.js";
export type {
  BudgetCategory,
  FeatureFlagsClientConfig,
  FlagSource,
  HubFeatureFlagsResponse,
  KillSwitch,
  ModuleName,
  ResolvedFlags,
  TierName,
} from "./types.js";
