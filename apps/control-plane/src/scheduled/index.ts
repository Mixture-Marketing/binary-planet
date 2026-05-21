/**
 * Scheduled dispatcher. Cron triggers from wrangler.toml fire `scheduled()` —
 * we route by cron expression to the right handler.
 *
 * Each handler:
 *   - logs job_runs row (start)
 *   - executes its work
 *   - updates job_runs (status, duration, items processed)
 *   - throws on critical errors → Worker treats as failed run (visible in CF dashboard)
 */

import { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";
import { generateAiBlogDrafts } from "./ai-blog-draft.js";
import { backupDaily } from "./backup.js";
import { competitorCheckWeekly } from "./competitor-check.js";
import { healthCheck } from "./health-check.js";
import { provisionPending } from "./provision-client.js";

export type ScheduledJobName =
  | "health_check_5min"
  | "provision_pending_2min"
  | "ai_blog_weekly"
  | "gsc_daily_pull"
  | "ga4_daily_pull"
  | "gbp_daily_pull"
  | "dataforseo_weekly"
  | "backup_daily"
  | "daily_digest"
  | "monthly_reports";

/** Map cron expression (as fired by wrangler) to job name + handler. */
const CRON_ROUTES: Record<string, ScheduledJobName> = {
  "*/5 * * * *": "health_check_5min",
  "*/2 * * * *": "provision_pending_2min",
  "0 8 * * 1": "ai_blog_weekly",
  "0 2 * * *": "gsc_daily_pull",
  "0 3 * * *": "ga4_daily_pull",
  "0 4 * * *": "gbp_daily_pull",
  "0 5 * * 1": "dataforseo_weekly",
  "0 6 * * *": "backup_daily",
  "0 9 * * *": "daily_digest",
  "0 0 1 * *": "monthly_reports",
};

/** Cloudflare ScheduledController event surface. */
interface ScheduledEventLike {
  cron: string;
  scheduledTime: number;
}

export async function runScheduled(event: ScheduledEventLike, env: Env): Promise<void> {
  const jobName = CRON_ROUTES[event.cron] ?? "unknown";
  const log = new Logger({
    requestId: `cron-${event.scheduledTime}`,
    module: "scheduled",
    workerName: "mm-control-plane",
  });

  const start = Date.now();
  log.info("cron.start", { cron: event.cron, job: jobName });

  const insertCronRun = await env.DB.prepare(
    `INSERT INTO cron_runs (job_name, cron_expression, started_at, status, items_processed, items_failed)
     VALUES (?, ?, datetime('now'), 'running', 0, 0)
     RETURNING id`,
  )
    .bind(jobName, event.cron)
    .first<{ id: number }>();
  const runId = insertCronRun?.id;

  let processed = 0;
  let failed = 0;
  let status: "success" | "partial_success" | "failed" = "success";
  let errorMessage: string | undefined;

  try {
    switch (jobName) {
      case "health_check_5min": {
        const result = await healthCheck(env, log);
        processed = result.checked;
        failed = result.failed;
        if (failed > 0 && failed < processed) status = "partial_success";
        break;
      }
      case "backup_daily": {
        await backupDaily(env, log);
        processed = 1;
        break;
      }
      case "provision_pending_2min": {
        const result = await provisionPending(env, log);
        processed = result.processed;
        failed = result.failed;
        if (failed > 0 && failed < processed) status = "partial_success";
        break;
      }
      case "ai_blog_weekly": {
        const result = await generateAiBlogDrafts(env);
        processed = result.processed;
        failed = result.failed;
        if (failed > 0 && failed < processed) status = "partial_success";
        log.info("ai_blog.complete", { processed: result.processed, successful: result.successful, skipped: result.skipped, failed: result.failed });
        break;
      }
      case "dataforseo_weekly": {
        // Track 24f-3 — Monitoring konkurencji addon (recurring SERP positions check)
        const r = await competitorCheckWeekly(env, log);
        processed = r.processed;
        failed = r.failed;
        if (failed > 0 && failed < processed) status = "partial_success";
        break;
      }
      // v0.1 stubs — implementations in Faza 5
      case "gsc_daily_pull":
      case "ga4_daily_pull":
      case "gbp_daily_pull":
      case "daily_digest":
      case "monthly_reports":
        log.info("cron.stub", { job: jobName, note: "not yet implemented" });
        break;
      default:
        log.warn("cron.unknown", { cron: event.cron });
        status = "failed";
        errorMessage = `unknown cron: ${event.cron}`;
    }
  } catch (e) {
    status = "failed";
    errorMessage = e instanceof Error ? e.message : "scheduled job threw";
    log.error("cron.error", e instanceof Error ? e : new Error(String(e)), { job: jobName });
  }

  const duration = Date.now() - start;
  if (runId !== undefined) {
    await env.DB.prepare(
      `UPDATE cron_runs
          SET finished_at = datetime('now'),
              duration_ms = ?,
              status = ?,
              items_processed = ?,
              items_failed = ?,
              error = ?
        WHERE id = ?`,
    )
      .bind(duration, status, processed, failed, errorMessage ?? null, runId)
      .run();
  }

  log.info("cron.end", { job: jobName, status, duration_ms: duration, processed, failed });

  // Re-throw so CF marks the scheduled run as failed (visible in dashboard).
  if (status === "failed" && errorMessage) {
    throw new Error(`Scheduled ${jobName} failed: ${errorMessage}`);
  }
}
