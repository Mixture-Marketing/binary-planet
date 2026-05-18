/**
 * Clients table data access.
 * Queries are written defensively — explicit columns, no SELECT *.
 */

export interface ClientRow {
  id: string;
  business_name: string;
  status: "pending" | "provisioning" | "active" | "paused" | "suspended" | "churned";
  tier: "starter" | "standard" | "premium";
  primary_domain: string | null;
  theme_preset: string;
  industry: string;
  subtype_schema: string;
  city: string;
  feature_flags_json: string;
  modules_json: string;
}

/**
 * Look up klient by sha256(api_key) — checks both current and rotated _new column
 * to support 7-day grace period during rotation.
 */
export async function findClientByApiKeyHash(
  db: D1Database,
  hashHex: string,
): Promise<ClientRow | null> {
  const result = await db
    .prepare(
      `SELECT id, business_name, status, tier, primary_domain, theme_preset, industry,
              subtype_schema, city, feature_flags_json, modules_json
         FROM clients
        WHERE api_key_hash = ? OR api_key_hash_new = ?
        LIMIT 1`,
    )
    .bind(hashHex, hashHex)
    .first<ClientRow>();
  return result ?? null;
}

/** Look up klient by id. Returns NULL if missing or churned. */
export async function findActiveClientById(
  db: D1Database,
  id: string,
): Promise<ClientRow | null> {
  return await db
    .prepare(
      `SELECT id, business_name, status, tier, primary_domain, theme_preset, industry,
              subtype_schema, city, feature_flags_json, modules_json
         FROM clients
        WHERE id = ? AND status NOT IN ('churned', 'suspended')
        LIMIT 1`,
    )
    .bind(id)
    .first<ClientRow>();
}

/** Parse merged feature flags JSON. */
export interface ClientFeatureFlags {
  modules: string[];
  flags: Record<string, unknown>;
}

export function parseFeatureFlags(client: ClientRow): ClientFeatureFlags {
  let flags: Record<string, unknown> = {};
  let modules: string[] = [];
  try {
    flags = JSON.parse(client.feature_flags_json) as Record<string, unknown>;
  } catch {
    /* fall through with defaults */
  }
  try {
    const parsed = JSON.parse(client.modules_json) as unknown;
    if (Array.isArray(parsed)) modules = parsed.filter((m): m is string => typeof m === "string");
  } catch {
    /* fall through */
  }
  return { modules, flags };
}
