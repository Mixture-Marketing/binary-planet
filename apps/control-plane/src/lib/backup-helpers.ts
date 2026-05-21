/**
 * Track 26 — D1 backup helpers (gzip + AES-GCM + table export).
 *
 * Used by scheduled/backup.ts for daily encrypted backups to R2.
 * Encryption: AES-GCM with 256-bit key derived from BACKUP_ENCRYPTION_KEY env (base64).
 * Compression: gzip via CompressionStream (Workers-native).
 */

/** Tables we DO back up — explicit allow-list to avoid backing up system_X tables. */
export const BACKUP_TABLES = [
  "clients",
  "client_contacts",
  "client_provisioning_configs",
  "client_addons",
  "subscriptions",
  "payments",
  "leads",
  "lead_replay_log",
  "competitor_monitoring_config",
  "competitor_snapshots",
  "audit_log",
  "alerts",
  "cron_runs",
  "ai_calls",
  "health_checks",
  "webhook_events",
  "addon_modules",
  "addon_bundles",
  "panel_sessions",
  "admin_users",
  "admin_sessions",
] as const;

/** Tables that have a `client_id` column — for per-klient filtered backups. */
export const PER_CLIENT_TABLES = [
  "client_contacts",
  "client_provisioning_configs",
  "client_addons",
  "subscriptions",
  "payments",
  "leads",
  "competitor_monitoring_config",
  "competitor_snapshots",
  "audit_log",
  "alerts",
  "health_checks",
] as const;

export interface BackupBundle {
  metadata: {
    version: string;
    type: "full" | "klient";
    client_id?: string;
    taken_at: string;
    table_counts: Record<string, number>;
    total_rows: number;
  };
  tables: Record<string, unknown[]>;
}

/**
 * Export all tables (or just per-klient subset) into a single JSON bundle.
 * Note: D1 in Workers has 30s CPU budget — for large DBs we limit per-table to 50k rows.
 */
const MAX_ROWS_PER_TABLE = 50_000;

export async function exportD1Tables(
  db: D1Database,
  opts: { type: "full" } | { type: "klient"; client_id: string },
): Promise<BackupBundle> {
  const tables = opts.type === "klient" ? PER_CLIENT_TABLES : BACKUP_TABLES;
  const tableCounts: Record<string, number> = {};
  const out: Record<string, unknown[]> = {};
  let total = 0;

  for (const table of tables) {
    try {
      let query = `SELECT * FROM ${table} LIMIT ${MAX_ROWS_PER_TABLE}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stmt: any = db.prepare(query);
      if (opts.type === "klient") {
        query = `SELECT * FROM ${table} WHERE client_id = ? LIMIT ${MAX_ROWS_PER_TABLE}`;
        stmt = db.prepare(query).bind(opts.client_id);
      }
      const r = await stmt.all();
      const rows = (r.results ?? []) as unknown[];
      out[table] = rows;
      tableCounts[table] = rows.length;
      total += rows.length;
    } catch (e) {
      // Table may not exist in this DB version — skip with warning
      out[table] = [];
      tableCounts[table] = -1; // sentinel for "skipped"
      // eslint-disable-next-line no-console
      console.warn(`backup: skip ${table} — ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return {
    metadata: {
      version: "v1",
      type: opts.type,
      ...(opts.type === "klient" && { client_id: opts.client_id }),
      taken_at: new Date().toISOString(),
      table_counts: tableCounts,
      total_rows: total,
    },
    tables: out,
  };
}

/** Gzip a Uint8Array → returns Uint8Array. Uses Workers-native CompressionStream. */
export async function gzipBytes(input: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(input).body!.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Decrypt key from base64 + AES-GCM encrypt.
 * IV is 12 random bytes, prepended to ciphertext.
 * Output format: [12 bytes IV][ciphertext][16 bytes auth tag]
 */
export async function aesGcmEncrypt(plaintext: Uint8Array, keyBase64: string): Promise<Uint8Array> {
  const keyBytes = base64ToBytes(keyBase64);
  if (keyBytes.length !== 32) {
    throw new Error(`BACKUP_ENCRYPTION_KEY must be 32 bytes base64-encoded (got ${keyBytes.length})`);
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Convert bundle → gzip → optional AES-GCM encrypt → final Uint8Array for R2 put.
 * If encryptionKey not provided, returns plain gzip (still safe at rest in R2).
 */
export async function buildBackupBlob(
  bundle: BackupBundle,
  opts: { encryptionKey?: string },
): Promise<{ bytes: Uint8Array; encrypted: boolean; size_bytes: number }> {
  const json = JSON.stringify(bundle);
  const jsonBytes = new TextEncoder().encode(json);
  const gz = await gzipBytes(jsonBytes);
  if (!opts.encryptionKey) {
    return { bytes: gz, encrypted: false, size_bytes: gz.length };
  }
  const enc = await aesGcmEncrypt(gz, opts.encryptionKey);
  return { bytes: enc, encrypted: true, size_bytes: enc.length };
}

/**
 * Cleanup R2 objects older than retentionDays under a prefix.
 * Returns count of deleted objects + total bytes freed.
 */
export async function cleanupOldBackups(
  bucket: R2Bucket,
  prefix: string,
  retentionDays: number,
): Promise<{ deleted: number; bytes_freed: number }> {
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  let deleted = 0;
  let bytesFreed = 0;
  // R2 list is paginated, cursor-based
  let cursor: string | undefined;
  do {
    const list = await bucket.list({ prefix, cursor, limit: 1000 });
    for (const obj of list.objects) {
      // Try parse date from key (.../{YYYY-MM-DD}.json.gz.enc)
      const m = obj.key.match(/(\d{4}-\d{2}-\d{2})/);
      if (!m) continue;
      const dateMs = Date.parse(m[1]!);
      if (Number.isNaN(dateMs) || dateMs > cutoff) continue;
      await bucket.delete(obj.key);
      deleted++;
      bytesFreed += obj.size;
    }
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
  return { deleted, bytes_freed: bytesFreed };
}
