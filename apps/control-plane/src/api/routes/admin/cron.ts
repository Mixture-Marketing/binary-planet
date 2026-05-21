/**
 * POST /api/admin/cron/run-now — manually trigger a scheduled job.
 *
 * Use case: free Workers plan doesn't support Cron Triggers. Run jobs via:
 *   - Manual "Run now" button in mm-admin /operations page
 *   - External cron service (cron-job.org, EasyCron) hitting this endpoint
 *
 * Auth (v0.1): X-BP-Admin-Key header == env.ADMIN_API_KEY secret.
 *   No header configured → endpoint is OFF (returns 403).
 *
 * Body: { job: "health_check_5min" | "provision_pending_2min" | "ai_blog_weekly" | "backup_daily" }
 * Returns: { ok: true, job, processed, failed, duration_ms }
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { generateAiBlogDrafts } from "../../../scheduled/ai-blog-draft.js";
import { backupDaily } from "../../../scheduled/backup.js";
import { competitorCheckWeekly } from "../../../scheduled/competitor-check.js";
import { healthCheck } from "../../../scheduled/health-check.js";
import { provisionPending } from "../../../scheduled/provision-client.js";
import { err, ok } from "../../lib/responses.js";

export const adminCronRouter = new Hono<HonoEnv>();

const ALLOWED_JOBS = [
  "health_check_5min",
  "provision_pending_2min",
  "ai_blog_weekly",
  "backup_daily",
  "dataforseo_weekly",
] as const;

type AllowedJob = (typeof ALLOWED_JOBS)[number];

adminCronRouter.post("/", async (c) => {
  const env = c.env;

  // Auth: require ADMIN_API_KEY header. If env var not set, endpoint is disabled.
  const expected = env.ADMIN_API_KEY;
  if (!expected) {
    return c.json(err("AUTH_MISSING_KEY", "Manual cron endpoint disabled — set ADMIN_API_KEY"), 403);
  }
  const provided = c.req.header("X-BP-Admin-Key");
  if (provided !== expected) {
    return c.json(err("AUTH_INVALID_KEY", "Invalid or missing X-BP-Admin-Key"), 401);
  }

  let body: { job?: string };
  try {
    body = (await c.req.json()) as { job?: string };
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }

  if (!body.job || !ALLOWED_JOBS.includes(body.job as AllowedJob)) {
    return c.json(
      err("VALIDATION_ERROR", `job must be one of: ${ALLOWED_JOBS.join(", ")}`),
      400,
    );
  }

  const log = c.get("logger");
  const start = Date.now();
  let processed = 0;
  let failed = 0;
  let extra: Record<string, unknown> = {};

  try {
    switch (body.job as AllowedJob) {
      case "health_check_5min": {
        const r = await healthCheck(env, log ?? (console as unknown as Parameters<typeof healthCheck>[1]));
        processed = r.checked;
        failed = r.failed;
        break;
      }
      case "provision_pending_2min": {
        const r = await provisionPending(env, log ?? (console as unknown as Parameters<typeof provisionPending>[1]));
        processed = r.processed;
        failed = r.failed;
        break;
      }
      case "ai_blog_weekly": {
        const r = await generateAiBlogDrafts(env);
        processed = r.processed;
        failed = r.failed;
        extra = { successful: r.successful, skipped: r.skipped, details: r.details };
        break;
      }
      case "backup_daily": {
        await backupDaily(env, log ?? (console as unknown as Parameters<typeof backupDaily>[1]));
        processed = 1;
        break;
      }
      case "dataforseo_weekly": {
        const r = await competitorCheckWeekly(env, log ?? (console as unknown as Parameters<typeof competitorCheckWeekly>[1]));
        processed = r.processed;
        failed = r.failed;
        extra = { queries: r.queries, cost_grosze_total: r.cost_grosze_total };
        break;
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    if (log) log.error("cron_run_now_failed", e instanceof Error ? e : new Error(message), { job: body.job });
    return c.json(err("INTERNAL_ERROR", `Job ${body.job} threw: ${message}`), 500);
  }

  const duration = Date.now() - start;

  // Record in cron_runs for visibility in mm-admin /operations
  const startedAtModifier = `-${Math.floor(duration / 1000) + 1} seconds`;
  await env.DB
    .prepare(
      `INSERT INTO cron_runs (job_name, cron_expression, started_at, finished_at, duration_ms,
                              status, items_processed, items_failed)
       VALUES (?, 'manual', datetime('now', ?), datetime('now'), ?, ?, ?, ?)`,
    )
    .bind(body.job, startedAtModifier, duration, failed > 0 ? "partial_success" : "success", processed, failed)
    .run()
    .catch(() => undefined); // cron_runs insertion isn't critical

  return c.json(ok({ job: body.job, processed, failed, duration_ms: duration, ...extra }), 200);
});
