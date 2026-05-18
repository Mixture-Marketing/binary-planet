/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

type RuntimeEnv = {
  RATE_LIMIT: KVNamespace;
  FALLBACK_QUEUE: KVNamespace;
  BP_CLIENT_API_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  TURNSTILE_SECRET?: string;
  PII_ENCRYPTION_KEY_B64?: string;
  HUB_BASE_URL?: string;
};

declare namespace App {
  interface Locals extends Runtime {
    /** Per-request CSP nonce (set by middleware). */
    nonce?: string;
  }
}

type Runtime = import("@astrojs/cloudflare").Runtime<RuntimeEnv>;
