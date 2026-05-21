/**
 * Track 24 — addon helpers (panel klienta).
 *
 * D1 reads + writes for addon catalog + activations. Shared D1 with hub,
 * so changes are immediately visible to all services.
 *
 * Stripe integration: v1 just records in D1. Real Stripe `subscriptionItems.create()`
 * comes in v2 — hub will reconcile pending activations into Stripe subs.
 */

export interface AddonModule {
  slug: string;
  name: string;
  category: "marketing_seo" | "design_ux" | "ai_automation" | "sales_conversion" | "security_analytics" | "one_time";
  short_description: string;
  long_description: string | null;
  benefit_line: string;
  price_grosze: number;
  currency: string;
  billing_period: "monthly" | "one_time";
  trial_days: number;
  recommended_for: string[];
  required_addons: string[];
  required_tier: string | null;
  exclusive_with: string[];
  display_order: number;
}

export interface AddonBundle {
  slug: string;
  name: string;
  description: string;
  addon_slugs: string[];
  bundle_price_grosze: number;
  recommended_for: string[];
  display_order: number;
}

export interface ClientAddon {
  id: number;
  addon_slug: string;
  status: "trial" | "active" | "paused" | "canceled";
  activated_at: string;
  trial_until: string | null;
  canceled_at: string | null;
  price_grosze_at_activation: number;
}

const CATEGORY_LABELS: Record<AddonModule["category"], string> = {
  marketing_seo: "Marketing i SEO",
  design_ux: "Design i UX",
  ai_automation: "AI i automatyzacja",
  sales_conversion: "Sprzedaż i konwersja",
  security_analytics: "Bezpieczeństwo i analityka",
  one_time: "Wdrożenia jednorazowe",
};

export function categoryLabel(c: AddonModule["category"]): string {
  return CATEGORY_LABELS[c];
}

export function formatPrice(grosze: number, period: AddonModule["billing_period"]): string {
  const zl = (grosze / 100).toFixed(grosze % 100 === 0 ? 0 : 2);
  return period === "monthly" ? `${zl} zł/mc` : `${zl} zł jedn.`;
}

function parseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
  } catch { /* empty */ }
  return [];
}

interface AddonModuleRow {
  slug: string;
  name: string;
  category: AddonModule["category"];
  short_description: string;
  long_description: string | null;
  benefit_line: string;
  price_grosze: number;
  currency: string;
  billing_period: AddonModule["billing_period"];
  trial_days: number;
  recommended_for_json: string;
  required_addons_json: string;
  required_tier: string | null;
  exclusive_with_json: string;
  display_order: number;
}

function rowToModule(r: AddonModuleRow): AddonModule {
  return {
    slug: r.slug,
    name: r.name,
    category: r.category,
    short_description: r.short_description,
    long_description: r.long_description,
    benefit_line: r.benefit_line,
    price_grosze: r.price_grosze,
    currency: r.currency,
    billing_period: r.billing_period,
    trial_days: r.trial_days,
    recommended_for: parseJsonArray(r.recommended_for_json),
    required_addons: parseJsonArray(r.required_addons_json),
    required_tier: r.required_tier,
    exclusive_with: parseJsonArray(r.exclusive_with_json),
    display_order: r.display_order,
  };
}

export async function listAddons(db: D1Database): Promise<AddonModule[]> {
  const result = await db
    .prepare(`SELECT * FROM addon_modules WHERE is_active = 1 ORDER BY display_order, slug`)
    .all<AddonModuleRow>();
  return (result.results ?? []).map(rowToModule);
}

export async function listBundles(db: D1Database): Promise<AddonBundle[]> {
  const result = await db
    .prepare(`SELECT * FROM addon_bundles WHERE is_active = 1 ORDER BY display_order`)
    .all<{
      slug: string;
      name: string;
      description: string;
      addon_slugs_json: string;
      bundle_price_grosze: number;
      recommended_for_json: string;
      display_order: number;
    }>();
  return (result.results ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    addon_slugs: parseJsonArray(r.addon_slugs_json),
    bundle_price_grosze: r.bundle_price_grosze,
    recommended_for: parseJsonArray(r.recommended_for_json),
    display_order: r.display_order,
  }));
}

/**
 * Verify a specific addon is currently active (or in trial) for the klient.
 * Use as guard in API endpoints that mutate addon-gated config.
 */
export async function isAddonActive(
  db: D1Database,
  clientId: string,
  addonSlug: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM client_addons
        WHERE client_id = ? AND addon_slug = ?
          AND status IN ('trial', 'active')
        LIMIT 1`,
    )
    .bind(clientId, addonSlug)
    .first<{ id: number }>();
  return Boolean(row);
}

export async function listClientAddons(db: D1Database, clientId: string): Promise<ClientAddon[]> {
  const result = await db
    .prepare(
      `SELECT id, addon_slug, status, activated_at, trial_until, canceled_at, price_grosze_at_activation
         FROM client_addons
        WHERE client_id = ?
          AND status IN ('trial', 'active')
        ORDER BY activated_at DESC`,
    )
    .bind(clientId)
    .all<ClientAddon>();
  return result.results ?? [];
}

/** Compute monthly addon spend (only recurring/active/trial). */
export function monthlyAddonSpend(addons: ClientAddon[], catalog: AddonModule[]): number {
  const monthlySlugs = new Set(catalog.filter((a) => a.billing_period === "monthly").map((a) => a.slug));
  return addons
    .filter((a) => monthlySlugs.has(a.addon_slug) && a.status !== "canceled")
    .reduce((sum, a) => sum + a.price_grosze_at_activation, 0);
}

/**
 * Activate an addon. v1: just D1 record. v2 (next): create Stripe subscription item.
 *
 * Returns:
 *   { ok: true, id } on success
 *   { ok: false, error } on conflict / invalid state
 */
export async function activateAddon(
  db: D1Database,
  clientId: string,
  slug: string,
): Promise<{ ok: true; id: number; trial_until: string | null } | { ok: false; error: string }> {
  // Fetch addon
  const addon = await db
    .prepare(`SELECT * FROM addon_modules WHERE slug = ? AND is_active = 1 LIMIT 1`)
    .bind(slug)
    .first<AddonModuleRow>();
  if (!addon) return { ok: false, error: `Addon ${slug} not found` };

  // Check if already active
  const existing = await db
    .prepare(
      `SELECT id FROM client_addons
        WHERE client_id = ? AND addon_slug = ?
          AND status IN ('trial', 'active')
        LIMIT 1`,
    )
    .bind(clientId, slug)
    .first<{ id: number }>();
  if (existing) return { ok: false, error: "Already active" };

  const trialUntil = addon.trial_days > 0
    ? new Date(Date.now() + addon.trial_days * 86400 * 1000).toISOString()
    : null;
  const status: ClientAddon["status"] = addon.trial_days > 0 ? "trial" : "active";

  const res = await db
    .prepare(
      `INSERT INTO client_addons (client_id, addon_slug, status, trial_until, price_grosze_at_activation, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(clientId, slug, status, trialUntil, addon.price_grosze, JSON.stringify({ source: "panel" }))
    .run();
  const id = Number(res.meta?.last_row_id ?? 0);

  await db
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('klient', 'addon.activated', 'addon', ?, ?, 'info', ?)`,
    )
    .bind(slug, clientId, JSON.stringify({ price_grosze: addon.price_grosze, status, trial_until: trialUntil }))
    .run();

  return { ok: true, id, trial_until: trialUntil };
}

export async function deactivateAddon(
  db: D1Database,
  clientId: string,
  slug: string,
  reason?: string,
): Promise<{ ok: boolean; canceled?: number }> {
  const res = await db
    .prepare(
      `UPDATE client_addons
          SET status = 'canceled',
              canceled_at = datetime('now'),
              cancel_reason = ?
        WHERE client_id = ? AND addon_slug = ? AND status IN ('trial', 'active')`,
    )
    .bind(reason ?? null, clientId, slug)
    .run();
  const changed = Number(res.meta?.changes ?? 0);
  if (changed > 0) {
    await db
      .prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
         VALUES ('klient', 'addon.deactivated', 'addon', ?, ?, 'info', ?)`,
      )
      .bind(slug, clientId, JSON.stringify({ reason: reason ?? null }))
      .run();
  }
  return { ok: changed > 0, canceled: changed };
}

/** Filter addons recommended for a klient's industry. Sorted by `recommended_for` match strength. */
export function filterRecommendedForIndustry(addons: AddonModule[], industry: string | null): AddonModule[] {
  if (!industry) return addons;
  return addons
    .filter((a) => a.recommended_for.includes(industry))
    .sort((a, b) => a.display_order - b.display_order);
}
