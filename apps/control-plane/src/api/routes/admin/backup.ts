/**
 * Track 26 — Admin backup operations.
 *
 * Endpoints (auth: X-BP-Admin-Key):
 *   GET  /api/admin/backup/list?prefix=d1/             — list R2 objects under prefix
 *   GET  /api/admin/backup/list?prefix=d1/klient/{id}/ — list per-klient backups
 *   GET  /api/admin/backup/get?key=d1/...              — download a backup (raw bytes, encrypted)
 *   POST /api/admin/backup/run-now                     — manual trigger (alias to cron)
 *
 * Note: /get returns the encrypted/gzipped bytes as-is. Restore is a manual process
 * (download, decrypt offline with BACKUP_ENCRYPTION_KEY, gunzip, parse JSON, manual restore).
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { err, ok } from "../../lib/responses.js";

export const adminBackupRouter = new Hono<HonoEnv>();

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

adminBackupRouter.get("/list", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const prefix = c.req.query("prefix") ?? "d1/";
  // Safety: only allow d1/ prefix to prevent listing all R2 objects
  if (!prefix.startsWith("d1/")) {
    return c.json(err("VALIDATION_ERROR", "prefix must start with d1/"), 400);
  }
  const list = await c.env.BACKUPS.list({ prefix, limit: 100 });
  return c.json(ok({
    prefix,
    truncated: list.truncated,
    objects: list.objects.map((o) => ({
      key: o.key,
      size_bytes: o.size,
      uploaded: o.uploaded,
      metadata: o.customMetadata,
    })),
  }), 200);
});

adminBackupRouter.get("/get", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const key = c.req.query("key");
  if (!key || !(key.startsWith("d1/") || key.startsWith("migrations/"))) {
    return c.json(err("VALIDATION_ERROR", "key required + must start with d1/ or migrations/"), 400);
  }
  const obj = await c.env.BACKUPS.get(key);
  if (!obj) return c.json(err("NOT_FOUND", `R2 key ${key} not found`), 404);

  return new Response(obj.body, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${key.split("/").pop() ?? "backup.gz.enc"}"`,
      ...(obj.size && { "Content-Length": String(obj.size) }),
    },
  });
});

adminBackupRouter.post("/run-now", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const log = c.get("logger");
  const start = Date.now();
  try {
    const { backupDaily } = await import("../../../scheduled/backup.js");
    await backupDaily(c.env, log ?? (console as unknown as Parameters<typeof backupDaily>[1]));
    return c.json(ok({ duration_ms: Date.now() - start }), 200);
  } catch (e) {
    return c.json(err("INTERNAL_ERROR", `Backup failed: ${e instanceof Error ? e.message : "unknown"}`), 500);
  }
});
