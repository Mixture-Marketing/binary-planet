/**
 * Track 26 — Real D1 backup to R2 (gzip + AES-GCM).
 *
 * Daily cron 06:00:
 *   1. Full DB backup → r2://mm-backups/d1/control-plane/{date}.json.gz.enc
 *      Retention: 30 days (BACKUP_RETENTION_DAYS_FULL env, default 30).
 *
 *   2. Per-klient backup for clients with `backup_pro` addon active.
 *      → r2://mm-backups/d1/klient/{client_id}/{date}.json.gz.enc
 *      Retention: 30 days (matches PRO addon SLA).
 *
 *   3. Cleanup R2 objects older than retention.
 *
 * Encryption: AES-GCM with BACKUP_ENCRYPTION_KEY (base64-encoded 32 bytes).
 * If key missing → backup runs but stays gzip-only (still useful, just not encrypted at rest).
 *
 * Restoration: see admin/backup.ts endpoint /api/admin/backup/list + /api/admin/backup/get.
 */

import type { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";
import { buildBackupBlob, cleanupOldBackups, exportD1Tables } from "../lib/backup-helpers.js";

const DEFAULT_RETENTION_DAYS = 30;

export async function backupDaily(env: Env, log: Logger): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const retention = Number(env.BACKUP_RETENTION_DAYS_FULL ?? DEFAULT_RETENTION_DAYS);

  // 1. FULL backup
  let fullResult: { ok: boolean; key?: string; size_bytes?: number; rows?: number; error?: string };
  try {
    const bundle = await exportD1Tables(env.DB, { type: "full" });
    const blob = await buildBackupBlob(bundle, {
      ...(env.BACKUP_ENCRYPTION_KEY && { encryptionKey: env.BACKUP_ENCRYPTION_KEY }),
    });
    const ext = blob.encrypted ? "json.gz.enc" : "json.gz";
    const key = `d1/control-plane/${date}.${ext}`;
    await env.BACKUPS.put(key, blob.bytes, {
      httpMetadata: { contentType: "application/octet-stream" },
      customMetadata: {
        type: "full",
        rows: String(bundle.metadata.total_rows),
        encrypted: String(blob.encrypted),
        taken_at: bundle.metadata.taken_at,
      },
    });
    fullResult = { ok: true, key, size_bytes: blob.size_bytes, rows: bundle.metadata.total_rows };
    log.info("backup.full_done", { key, size_bytes: blob.size_bytes, rows: bundle.metadata.total_rows, encrypted: blob.encrypted });
  } catch (e) {
    fullResult = { ok: false, error: e instanceof Error ? e.message : "unknown" };
    log.error("backup.full_failed", e instanceof Error ? e : new Error(String(e)));
  }

  await env.DB.prepare(
    `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
     VALUES ('system', 'backup.full', 'r2_object', ?, ?, ?)`,
  )
    .bind(
      fullResult.key ?? `d1/control-plane/${date}.failed`,
      fullResult.ok ? "info" : "error",
      JSON.stringify(fullResult),
    )
    .run();

  // 2. PER-KLIENT backups (backup_pro addon)
  await backupProForActiveAddons(env, log, date);

  // 3. Cleanup old backups
  try {
    const c1 = await cleanupOldBackups(env.BACKUPS, "d1/control-plane/", retention);
    const c2 = await cleanupOldBackups(env.BACKUPS, "d1/klient/", retention);
    log.info("backup.cleanup", { full: c1, klient: c2 });
  } catch (e) {
    log.warn("backup.cleanup_failed", { error: e instanceof Error ? e.message : "unknown" });
  }
}

/**
 * For each klient with backup_pro addon active, write per-klient backup.
 */
async function backupProForActiveAddons(env: Env, log: Logger, date: string): Promise<void> {
  const rows = await env.DB
    .prepare(
      `SELECT client_id FROM client_addons
        WHERE addon_slug = 'backup_pro' AND status IN ('trial','active')`,
    )
    .all<{ client_id: string }>();
  const list = rows.results ?? [];
  if (list.length === 0) {
    log.info("backup_pro.no_active_addons");
    return;
  }

  for (const r of list) {
    try {
      const bundle = await exportD1Tables(env.DB, { type: "klient", client_id: r.client_id });
      const blob = await buildBackupBlob(bundle, {
        ...(env.BACKUP_ENCRYPTION_KEY && { encryptionKey: env.BACKUP_ENCRYPTION_KEY }),
      });
      const ext = blob.encrypted ? "json.gz.enc" : "json.gz";
      const key = `d1/klient/${r.client_id}/${date}.${ext}`;
      await env.BACKUPS.put(key, blob.bytes, {
        httpMetadata: { contentType: "application/octet-stream" },
        customMetadata: {
          type: "klient",
          client_id: r.client_id,
          rows: String(bundle.metadata.total_rows),
          encrypted: String(blob.encrypted),
        },
      });
      await env.DB
        .prepare(
          `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
           VALUES ('system', 'backup.klient', 'r2_object', ?, ?, 'info', ?)`,
        )
        .bind(key, r.client_id, JSON.stringify({ size_bytes: blob.size_bytes, rows: bundle.metadata.total_rows, encrypted: blob.encrypted }))
        .run();
    } catch (e) {
      log.error("backup_pro.klient_failed", e instanceof Error ? e : new Error(String(e)), { client_id: r.client_id });
    }
  }
  log.info("backup_pro.completed", { klients: list.length });
}
