/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

type RuntimeEnv = {
  DB: D1Database;
  CONFIG: KVNamespace;
  ADMIN_SESSIONS: KVNamespace;
  UPLOADS: R2Bucket;
  HUB_BASE_URL?: string;
  LOG_LEVEL?: "debug" | "info" | "warn" | "error";
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  SESSION_SIGNING_KEY?: string;
  D1_ENCRYPTION_KEY?: string;
};

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
