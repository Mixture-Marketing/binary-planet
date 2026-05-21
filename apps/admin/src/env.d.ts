/// <reference path="../.astro/types.d.ts" />
/// <reference path="../worker-configuration.d.ts" />

// Bindings (DB/KV/R2) + vars come from wrangler-generated worker-configuration.d.ts
// via `pnpm cf-types`. This file adds runtime secrets (not declared in wrangler.jsonc).
declare namespace Cloudflare {
  interface Env {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    SESSION_SIGNING_KEY?: string;
    D1_ENCRYPTION_KEY?: string;
    /** Hub admin API key (mirror of hub's ADMIN_API_KEY). Used to trigger cron remotely. */
    ADMIN_API_KEY?: string;
  }
}

// Legacy alias — some code still references `RuntimeEnv` directly.
type RuntimeEnv = Cloudflare.Env;

declare namespace App {
  interface Locals extends Runtime {
    /** Per-request CSP nonce. */
    nonce?: string;
    /** Authenticated admin user — set by middleware on protected routes. */
    user?: {
      id: string;
      email: string;
      displayName: string;
      role: "admin" | "va" | "read_only" | "billing_only";
    };
  }
}

type Runtime = import("@astrojs/cloudflare").Runtime<RuntimeEnv>;
