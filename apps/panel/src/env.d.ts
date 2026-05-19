/// <reference types="astro/client" />

interface RuntimeEnv {
  DB: D1Database;
  CONFIG: KVNamespace;
  PANEL_SESSIONS: KVNamespace;
  INVOICES: R2Bucket;
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
