/**
 * Worker bindings + secrets, typed.
 * Single source of truth — every route + middleware imports `Env` from here.
 */

export interface Env {
  // D1
  DB: D1Database;

  // KV
  RATE_LIMIT: KVNamespace;
  CONFIG: KVNamespace;
  DEDUP: KVNamespace;

  // R2
  BACKUPS: R2Bucket;
  UPLOADS: R2Bucket;

  // Vars (non-secret, from wrangler.toml)
  HUB_BASE_URL?: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";

  // Secrets (wrangler secret put)
  ANTHROPIC_API_KEY?: string;
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SMSAPI_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  P24_MERCHANT_ID?: string;
  P24_CRC_KEY?: string;
  P24_API_KEY?: string;
  FAKTUROWNIA_API_TOKEN?: string;
  REGON_USER_KEY?: string;
  OVH_APP_KEY?: string;
  OVH_APP_SECRET?: string;
  OVH_CONSUMER_KEY?: string;
  /** OVH endpoint, e.g. "ovh-eu". Default "ovh-eu". */
  OVH_ENDPOINT?: string;
  GH_APP_PRIVATE_KEY?: string;
  /** GitHub Personal Access Token (scope: repo). For Track 4 provisioning (fork + commit). */
  GITHUB_PAT?: string;
  /** GitHub org/owner under which klient repos are created. Default "MixtureMarketing". */
  GITHUB_ORG?: string;
  /** GitHub source repo path. Default "MixtureMarketing/binary-planet". */
  GITHUB_SOURCE_REPO?: string;
  /** Cloudflare API token (scope: Workers Scripts:Edit, DNS:Edit). For Track 4. */
  CF_API_TOKEN?: string;
  /** Cloudflare account ID. */
  CF_ACCOUNT_ID?: string;
  /** Cloudflare zone ID for the agency root domain (used when assigning custom domains). */
  CF_ZONE_ID?: string;
  /**
   * Track 4 dry-run mode. When "true", provisioning logs each step but does not call
   * external APIs (OVH/GitHub/CF). Useful for local dev + integration tests.
   * Default: "true" while we don't have real secrets configured.
   */
  PROVISIONING_DRY_RUN?: string;
  GOOGLE_SERVICE_ACCOUNT_B64?: string;
  TURNSTILE_SECRET_KEY?: string;
  JWT_SIGNING_KEY?: string;
  D1_ENCRYPTION_KEY?: string;
  BACKUP_ENCRYPTION_KEY?: string;
}

/** Variables Hono stores on context (typed via `c.set` / `c.get`). */
export interface HonoVariables {
  requestId: string;
  /** Set by auth middleware after successful X-BP-Client-Key verify. */
  authenticatedClientId?: string;
  /** Set by logger middleware for downstream handlers. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logger?: any;
}

/** Hono context type — use in route handlers as `Context<HonoEnv>`. */
export interface HonoEnv {
  Bindings: Env;
  Variables: HonoVariables;
}
