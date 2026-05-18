/**
 * Feature flags types.
 *
 * Resolution order (highest priority wins):
 *   1. Hub override (D1 feature_flag_overrides table) — admin/incident response
 *   2. Kill switches (CONFIG KV — global, fast)
 *   3. Client config (compiled into spoke at build time)
 *   4. Tier defaults
 *
 * Module enabled = explicit allow in modules list at any level.
 * Budget caps independent — checked separately before expensive operations.
 */

/**
 * Known module names. Each maps to a billable feature.
 * Per plan: client.config.modules[] holds active set; tier dictates defaults.
 */
export const KNOWN_MODULES = [
  // Core (always on for all tiers)
  "care",
  "local_basic",

  // Standard tier add-ons
  "reputation",
  "citation_basic",
  "monthly_reports",

  // Premium tier add-ons
  "ai_blog",
  "citation_premium",
  "gbp_auto_post",
  "google_ads_managed",
  "meta_ads_managed",
  "panel_klienta",
  "multi_location",
  "geo_ai_optimization",
] as const;

export type ModuleName = (typeof KNOWN_MODULES)[number];

export type TierName = "starter" | "standard" | "premium";

export const TIER_DEFAULT_MODULES: Readonly<Record<TierName, readonly ModuleName[]>> = {
  starter: ["care", "local_basic"],
  standard: ["care", "local_basic", "reputation", "citation_basic", "monthly_reports"],
  premium: [
    "care",
    "local_basic",
    "reputation",
    "citation_basic",
    "monthly_reports",
    "ai_blog",
    "citation_premium",
    "gbp_auto_post",
    "panel_klienta",
  ],
};

/**
 * Kill switches — global flags in CONFIG KV. Trigger across all spokes immediately.
 * Names match runbook references (e.g. P2-anthropic-rate-limit.md uses AI_KILL_SWITCH).
 */
export const KILL_SWITCHES = [
  "MAINTENANCE_MODE", // global maintenance — spoke fallback queues all writes
  "AI_KILL_SWITCH", // no Anthropic API calls (cost spike circuit breaker)
  "FORMS_KILL_SWITCH", // form submissions disabled (very rare — for breach response)
  "WEBHOOKS_KILL_SWITCH", // stop processing webhooks (Stripe etc.)
] as const;

export type KillSwitch = (typeof KILL_SWITCHES)[number];

/**
 * Budget cap categories. Per-klient monthly limits.
 * `0` = unlimited. Values stored in client.budget_caps_json + overridable via hub.
 */
export const BUDGET_CATEGORIES = [
  "ai_monthly_usd", // Anthropic spend per month (USD)
  "sms_monthly_pln", // SMSAPI spend per month (PLN)
  "ads_monthly_pln", // Google/Meta Ads spend (PLN)
  "datataforseo_monthly_usd", // DataForSEO spend
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export type FlagSource = "tier_default" | "client_config" | "hub_override" | "kill_switch";

export interface FeatureFlagsClientConfig {
  /** Klient ID — used for hub fetch URL + KV cache key. */
  clientId: string;
  /** Klient tier — sets module defaults. */
  tier: TierName;
  /** Base config from client.config.ts: enabled modules + budget caps. */
  baseConfig: {
    modules?: readonly ModuleName[];
    budgets?: Partial<Record<BudgetCategory, number>>;
    /** Arbitrary additional flags (e.g. ai_blog_enabled boolean). */
    flags?: Record<string, unknown>;
  };
}

export interface ResolvedFlags {
  /** Active modules (union of tier + client config + hub override). */
  modules: ReadonlySet<ModuleName>;
  /** Budget caps per category. 0 or undefined = unlimited. */
  budgets: Readonly<Partial<Record<BudgetCategory, number>>>;
  /** Arbitrary feature flag values (typed by caller). */
  flags: Readonly<Record<string, unknown>>;
  /** Active kill switches. */
  killSwitches: ReadonlySet<KillSwitch>;
  /** When was this resolved (for cache freshness). */
  resolvedAt: string;
}

/**
 * Hub response shape — what GET /api/feature-flags returns.
 */
export interface HubFeatureFlagsResponse {
  client_id: string;
  tier: TierName;
  modules: ModuleName[];
  budgets?: Partial<Record<BudgetCategory, number>>;
  flags?: Record<string, unknown>;
  refreshed_at: string;
}
