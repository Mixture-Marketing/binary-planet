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
  /** Skip Anthropic API + GH PR in dev/tests. Default false (auto-skipped if key missing). */
  BLOG_AI_DRY_RUN?: string;
  DATAFORSEO_LOGIN?: string;
  DATAFORSEO_PASSWORD?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SMSAPI_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Stripe Price IDs per tier (TIER_PRICE_IDS env JSON or individual). */
  STRIPE_PRICE_STARTER?: string;       // Track 25: price_xxx for 179 zł/mc
  STRIPE_PRICE_STANDARD?: string;      // Track 25: price_xxx for 249 zł/mc
  STRIPE_PRICE_PREMIUM?: string;       // Track 25: price_xxx for 349 zł/mc
  STRIPE_PRICE_PROFESSIONAL?: string;  // Track 25: price_xxx for 549 zł/mc — B2B regulated
  /** Base URL for Stripe Checkout success/cancel redirects (admin or panel). Default admin. */
  STRIPE_CHECKOUT_RETURN_URL?: string; // e.g. "https://app.mixturemarketing.pl"
  P24_MERCHANT_ID?: string;
  P24_CRC_KEY?: string;
  P24_API_KEY?: string;
  FAKTUROWNIA_API_TOKEN?: string;
  /** Fakturownia subdomain (login). e.g. "mixturemarketing" → https://mixturemarketing.fakturownia.pl */
  FAKTUROWNIA_LOGIN?: string;
  /** Skip Fakturownia API calls in tests/dev. Default false (auto-skipped if token missing). */
  FAKTUROWNIA_DRY_RUN?: string;
  REGON_USER_KEY?: string;
  OVH_APP_KEY?: string;
  OVH_APP_SECRET?: string;
  OVH_CONSUMER_KEY?: string;
  /** OVH endpoint, e.g. "ovh-eu". Default "ovh-eu". */
  OVH_ENDPOINT?: string;
  GH_APP_PRIVATE_KEY?: string;
  /** GitHub Personal Access Token (scope: repo). For Track 4 provisioning (fork + commit). */
  GITHUB_PAT?: string;
  /** GitHub OAuth App client ID — used by Sveltia OAuth proxy (Track 9). */
  GITHUB_OAUTH_CLIENT_ID?: string;
  GITHUB_OAUTH_CLIENT_SECRET?: string;
  /** Admin API key for /api/admin/* manual endpoints (cron run-now). v0.1 single shared secret. */
  ADMIN_API_KEY?: string;
  /**
   * Public-ish key for /api/admin/preonboard — wstrzykiwany w build marketingowego landing
   * (mixturemarketing.pl). Klucz idzie do przeglądarki klienta, więc:
   *   - rate-limited per IP (5 prób/h)
   *   - scope: TYLKO POST /api/admin/preonboard + POST /api/admin/stripe/checkout
   *   - rotujemy raz w miesiącu
   */
  PREONBOARD_PUBLIC_KEY?: string;
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
  /** Cloudflare account workers.dev subdomain (e.g. "dark-limit-982e"). For preview URLs in TEST_MODE. */
  CF_WORKERS_DEV_SUBDOMAIN?: string;
  /**
   * Track 4 dry-run mode. When "true", provisioning logs each step but does not call
   * external APIs (OVH/GitHub/CF). Useful for local dev + integration tests.
   * Default: "true" while we don't have real secrets configured.
   */
  PROVISIONING_DRY_RUN?: string;
  /**
   * Track 14 test mode. When "true" (and DRY_RUN != "true"):
   *   - OVH: real availability check via cart probe (no checkout = no charge)
   *   - GitHub: real repo create + commit
   *   - CF: real Worker deploy → preview URL on *.workers.dev (no custom domain attach)
   * Useful for end-to-end staging without spending money on domains.
   */
  PROVISIONING_TEST_MODE?: string;
  GOOGLE_SERVICE_ACCOUNT_B64?: string;
  TURNSTILE_SECRET_KEY?: string;
  JWT_SIGNING_KEY?: string;
  D1_ENCRYPTION_KEY?: string;
  BACKUP_ENCRYPTION_KEY?: string;
  /** Track 26: backup retention days for full DB dumps (default 30). */
  BACKUP_RETENTION_DAYS_FULL?: string;
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
