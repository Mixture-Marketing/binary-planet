/**
 * Admin endpoints for lifecycle ops (Track 22) — manual trigger churn + reactivate.
 *
 * Use cases:
 *   - Manual churn (klient zadzwonił z odejściem, my robimy ręcznie zamiast czekać na Stripe webhook)
 *   - Manual reactivation (klient wraca przez inną ścieżkę niż preonboard)
 *   - Testing pipeline
 *
 * Auth: X-BP-Admin-Key.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { executeChurnPipeline, executeReactivatePipeline } from "../../../scheduled/lifecycle.js";
import { err, ok } from "../../lib/responses.js";

export const adminLifecycleRouter = new Hono<HonoEnv>();

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

adminLifecycleRouter.post("/clients/:id/churn", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const id = c.req.param("id");
  if (!id) return c.json(err("VALIDATION_ERROR", "client id required"), 400);

  try {
    await c.env.DB
      .prepare(`UPDATE clients SET status = 'churned', churned_at = datetime('now') WHERE id = ? AND status != 'churned'`)
      .bind(id)
      .run();

    const result = await executeChurnPipeline(c.env, id);
    return c.json(ok(result), 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json(err("INTERNAL_ERROR", `Churn pipeline failed: ${msg}`), 500);
  }
});

adminLifecycleRouter.post("/clients/:id/reactivate", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const id = c.req.param("id");
  if (!id) return c.json(err("VALIDATION_ERROR", "client id required"), 400);

  const result = await executeReactivatePipeline(c.env, id);
  return c.json(ok(result), result.ok ? 200 : 422);
});
