/**
 * Daily D1 backup → R2 mm-backups bucket.
 *
 * v0.1 stub: D1 doesn't yet have a built-in export API for Workers (as of late 2026).
 * Real implementation paths:
 *   a) Use `wrangler d1 export` via CF API from a separate process (preferred)
 *   b) SELECT * FROM each table → JSON.stringify → R2 put (works but expensive)
 *
 * For Faza 5 we'll likely implement (a) via a small companion script triggered by GH Actions
 * rather than Workers itself — Workers have CPU budget limits that conflict with large exports.
 *
 * This handler just records that the cron fired + audit_log entry; actual backup happens
 * via external orchestration. Once D1 export-from-Worker is available, swap in real logic.
 */

import type { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";
import { newId } from "../api/lib/ids.js";

export async function backupDaily(env: Env, log: Logger): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const placeholderKey = `d1/control-plane/${date}.placeholder`;

  // Write a tiny marker to R2 so we can see backup cron is firing.
  await env.BACKUPS.put(
    placeholderKey,
    JSON.stringify({ date, status: "placeholder_pending_real_implementation", at: new Date().toISOString() }),
    { httpMetadata: { contentType: "application/json" } },
  );

  await env.DB.prepare(
    `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
     VALUES ('system', 'backup.placeholder_run', 'r2_object', ?, 'info', ?)`,
  )
    .bind(placeholderKey, JSON.stringify({ date }))
    .run();

  log.info("backup.placeholder_recorded", { key: placeholderKey });
}
