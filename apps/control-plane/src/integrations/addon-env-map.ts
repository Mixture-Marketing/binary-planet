/**
 * Track 24h — mapping addon_slug → env vars to set on klient Worker.
 *
 * When a klient has an addon active, these env vars are PUT as Worker secrets
 * so the klient site can check them via env.WHATEVER_ENABLED === "true".
 *
 * When an addon is deactivated, the same key is set to "false" (not removed,
 * because removing secrets has more edge cases — false is safer).
 */

export interface AddonEnvSpec {
  /** Map of env var name → value when addon is active. */
  active: Record<string, string>;
  /** Map of env var name → value when addon is inactive (defaults if omitted: same keys set to "false" or removed). */
  inactive?: Record<string, string>;
}

export const ADDON_ENV_MAP: Record<string, AddonEnvSpec> = {
  // Chatbot tiers — exclusive (only one tier active at a time)
  chatbot_basic: {
    active: { CHATBOT_ENABLED: "true", CHATBOT_TIER: "basic" },
    inactive: { CHATBOT_ENABLED: "false" },
  },
  chatbot_pro: {
    active: { CHATBOT_ENABLED: "true", CHATBOT_TIER: "pro" },
    inactive: { CHATBOT_ENABLED: "false" },
  },
  chatbot_premium: {
    active: { CHATBOT_ENABLED: "true", CHATBOT_TIER: "premium" },
    inactive: { CHATBOT_ENABLED: "false" },
  },

  // Lead capture
  leadpop_discount: { active: { LEADPOP_ENABLED: "true" } },
  fomo_counter: { active: { FOMO_COUNTER_ENABLED: "true" } },
  call_tracking: { active: { CALL_TRACKING_ENABLED: "true" } },

  // Visual
  instagram_sync: { active: { INSTAGRAM_SYNC_ENABLED: "true" } },

  // SEO
  geo_llm_pro: { active: { GEO_LLM_PRO_ENABLED: "true" } },
  blog_ai: { active: { BLOG_AI_ENABLED: "true" } },

  // Reviews / GBP
  reviews_pro: { active: { REVIEWS_PRO_ENABLED: "true" } },

  // Newsletter (Track 24f-4)
  newsletter_sms: { active: { NEWSLETTER_SMS_ENABLED: "true" } },

  // Security
  backup_pro: { active: { BACKUP_PRO_ENABLED: "true" } },
  analytics_pro: { active: { ANALYTICS_PRO_ENABLED: "true" } },

  // One-time addons don't need env vars (server-side actions only)
  // nfc_stand, booking_integration, language_addon, etc. — handled separately
};

/**
 * Compute the full env var set for a klient based on their active addons.
 *
 * Strategy:
 *   1. Start with all known env keys = "false"
 *   2. For each active addon, override with its `active` map
 *   3. Result: complete picture — every known key has a definite value
 */
export function computeWorkerEnvFromAddons(activeAddonSlugs: string[]): Record<string, string> {
  // 1. Collect all known env keys with default "false"
  const allKeys = new Set<string>();
  for (const spec of Object.values(ADDON_ENV_MAP)) {
    for (const k of Object.keys(spec.active)) allKeys.add(k);
    if (spec.inactive) for (const k of Object.keys(spec.inactive)) allKeys.add(k);
  }
  const env: Record<string, string> = {};
  for (const k of allKeys) env[k] = "false";

  // 2. Apply active addon overrides
  for (const slug of activeAddonSlugs) {
    const spec = ADDON_ENV_MAP[slug];
    if (!spec) continue;
    for (const [k, v] of Object.entries(spec.active)) {
      env[k] = v;
    }
  }

  return env;
}
