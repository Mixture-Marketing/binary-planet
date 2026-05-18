/**
 * GET /api/health — public, no auth required.
 *
 * Returns hub status + DB connectivity check. Used by:
 *   - Synthetic monitor (every 5 min)
 *   - Better Stack ping
 *   - Spoke health diagnostics
 *   - Status page (status.mixturemarketing.pl)
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../env.js";
import { ok } from "../lib/responses.js";

export const healthRouter = new Hono<HonoEnv>();

interface HealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime_ms: number;
  checks: {
    db: { ok: boolean; latency_ms?: number; error?: string };
  };
}

const STARTED_AT = Date.now();
const VERSION = "0.0.1"; // bumped per deploy via CI

healthRouter.get("/", async (c) => {
  const checks: HealthResponse["checks"] = {
    db: { ok: false },
  };

  // DB connectivity check — single trivial query
  const dbStart = Date.now();
  try {
    const row = await c.env.DB.prepare("SELECT 1 AS x").first<{ x: number }>();
    if (row?.x === 1) {
      checks.db = { ok: true, latency_ms: Date.now() - dbStart };
    } else {
      checks.db = { ok: false, error: "unexpected query result" };
    }
  } catch (err) {
    checks.db = {
      ok: false,
      error: err instanceof Error ? err.message : "db check failed",
    };
  }

  const status: HealthResponse["status"] = checks.db.ok ? "ok" : "degraded";

  const body: HealthResponse = {
    status,
    version: VERSION,
    uptime_ms: Date.now() - STARTED_AT,
    checks,
  };

  return c.json(ok(body), status === "ok" ? 200 : 503);
});
