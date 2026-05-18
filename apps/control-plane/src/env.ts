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
  GH_APP_PRIVATE_KEY?: string;
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
