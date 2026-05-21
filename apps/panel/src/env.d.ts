/// <reference types="astro/client" />

declare module "cloudflare:workers" {
  export const env: RuntimeEnv;
}

interface RuntimeEnv {
  DB: D1Database;
  CONFIG: KVNamespace;
  PANEL_SESSIONS: KVNamespace;
  INVOICES: R2Bucket;
  UPLOADS: R2Bucket;
  ADMIN_API_KEY?: string;
  HUB_BASE_URL?: string;
  LOG_LEVEL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SESSION_SIGNING_KEY?: string;
  D1_ENCRYPTION_KEY?: string;
}

declare namespace App {
  interface Locals {
    runtime?: { env: RuntimeEnv };
    /** Loaded by middleware from validated panel_session cookie. */
    client?: {
      id: string;
      businessName: string;
      tier: "starter" | "standard" | "premium";
      status: string;
    };
    nonce?: string;
  }
}
