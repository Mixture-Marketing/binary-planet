/**
 * @mixturemarketing/web-core/feature-flags
 *
 * Scope: lightweight per-client feature flags (no LaunchDarkly overhead).
 *
 *  - Source: client.config.ts (build-time) + Hub D1 (runtime override via /api/feature-flags)
 *  - 5-min KV cache w spoke (reduce hub round-trips)
 *  - Module toggles: ai_blog, citation_premium, gbp_auto_post, monthly_reports,
 *                    google_ads_managed, meta_ads_managed, panel_klienta, ...
 *  - Budget caps: ai_monthly_budget_usd, sms_monthly_budget_pln (per klient)
 *  - Kill switches: AI_KILL_SWITCH, MAINTENANCE_MODE (global, KV-based)
 *  - Override mechanism: admin force-flag dla testów (z TTL)
 *
 * Reference: plan/00-main.md (Faza 1), plan/J-hub-spoke.md (feature-flags endpoint).
 */

export const MODULE_NAME = "feature-flags" as const;
