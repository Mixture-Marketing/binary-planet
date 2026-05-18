/**
 * Shared test setup: build a fresh Worker env with mock D1/KV/R2 + seed test klient.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Hex } from "../src/api/lib/hash.js";
import type { Env } from "../src/env.js";
import { createMockD1, createMockKv, createMockR2 } from "./d1-mock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

export interface TestSetup {
  env: Env;
  /** Test API key — pass as X-BP-Client-Key in requests. */
  apiKey: string;
  /** ID of seeded test klient. */
  clientId: string;
}

export async function setupTestEnv(): Promise<TestSetup> {
  const env: Env = {
    DB: createMockD1({ migrationsDir: MIGRATIONS_DIR }),
    RATE_LIMIT: createMockKv(),
    CONFIG: createMockKv(),
    DEDUP: createMockKv(),
    BACKUPS: createMockR2(),
    UPLOADS: createMockR2(),
    HUB_BASE_URL: "https://api.test.local",
    LOG_LEVEL: "warn",
  };

  // Seed one active klient
  const clientId = "clk_test";
  const apiKey = "ck_live_testkey_abcdef1234567890";
  const apiKeyHash = await sha256Hex(apiKey);

  await env.DB.prepare(
    `INSERT INTO clients (
       id, business_name, industry, subtype_schema, theme_preset, city, tier, status,
       primary_domain, api_key_hash, feature_flags_json, modules_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      clientId,
      "Ślusarz Test",
      "locksmith",
      "Locksmith",
      "craftsman",
      "Rzeszów",
      "starter",
      "active",
      "test-locksmith.pl",
      apiKeyHash,
      '{"ai_blog_enabled":false}',
      '["care"]',
    )
    .run();

  return { env, apiKey, clientId };
}

/** Build a Request with JSON body. */
export function jsonRequest(
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Request {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(url, init);
}
