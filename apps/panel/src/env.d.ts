/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

// Bindings (DB/KV/R2) + vars come from wrangler-generated worker-configuration.d.ts
// via `pnpm cf-types`. This file adds runtime secrets (not declared in wrangler.jsonc).
declare namespace Cloudflare {
  interface Env {
    ADMIN_API_KEY?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
    SESSION_SIGNING_KEY?: string;
    D1_ENCRYPTION_KEY?: string;
  }
}

// Legacy alias — some code still references `RuntimeEnv` directly.
type RuntimeEnv = Cloudflare.Env;

declare namespace App {
  interface Locals {
    runtime?: { env: RuntimeEnv };
    /** Loaded by middleware from validated panel_session cookie. */
    client?: {
      id: string;
      businessName: string;
      tier: "starter" | "standard" | "premium" | "professional";
      status: string;
    };
    nonce?: string;
  }
}
