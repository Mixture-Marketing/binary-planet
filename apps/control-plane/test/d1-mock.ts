/**
 * node:sqlite-backed D1Database mock for integration tests.
 *
 * Implements the subset of D1's API our code uses: prepare(), bind(), first(), all(), run().
 * Run schema migrations once at construction → DB ready for repos/routes.
 *
 * NOTE: this is a TEST-ONLY helper. Production hits real D1.
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// Vite's pre-bundling cannot resolve `node:sqlite` (experimental Node feature).
// Bypass with createRequire which uses raw Node module resolution.
const requireFromHere = createRequire(import.meta.url);
const sqliteModule = requireFromHere("node:sqlite") as {
  DatabaseSync: new (path: string) => DatabaseSyncInstance;
};
const DatabaseSync = sqliteModule.DatabaseSync;

interface DatabaseSyncInstance {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
}

interface StatementSync {
  get(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
  run(...values: unknown[]): {
    changes?: number | bigint;
    lastInsertRowid?: number | bigint;
  };
}

export interface MockD1Options {
  /** Path to migrations directory (apply all .sql files in lexical order). */
  migrationsDir?: string;
}

/** Build a fresh in-memory D1Database-compatible mock. */
export function createMockD1(options: MockD1Options = {}): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");

  if (options.migrationsDir) {
    const files = fs
      .readdirSync(options.migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(options.migrationsDir, f), "utf-8");
      db.exec(sql);
    }
  }

  return wrapAsD1(db);
}

/** Adapter from node:sqlite to D1Database interface. */
function wrapAsD1(db: DatabaseSyncInstance): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter: any = {
    prepare(sql: string) {
      // node:sqlite uses ? bind params (same as D1). Reuse same statement string.
      let stmt: StatementSync | null = null;
      const ensure = (): StatementSync => {
        if (stmt === null) stmt = db.prepare(sql);
        return stmt;
      };
      let boundValues: unknown[] = [];

      const wrapper: D1PreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return wrapper;
        },
        async first<T = unknown>(_colName?: string) {
          const s = ensure();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const row = s.get(...(boundValues as never[]));
          if (row === undefined) return null;
          return row as T;
        },
        async all<T = unknown>() {
          const s = ensure();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const rows = s.all(...(boundValues as never[]));
          return {
            results: rows as T[],
            success: true,
            meta: {
              duration: 0,
              changes: 0,
              last_row_id: 0,
              rows_read: rows.length,
              rows_written: 0,
              size_after: 0,
              served_by: "mock",
              changed_db: false,
            },
          } as unknown as D1Result<T>;
        },
        async run() {
          const s = ensure();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const info = s.run(...(boundValues as never[]));
          return {
            results: [],
            success: true,
            meta: {
              duration: 0,
              changes: Number(info.changes ?? 0),
              last_row_id: Number(info.lastInsertRowid ?? 0),
              rows_read: 0,
              rows_written: Number(info.changes ?? 0),
              size_after: 0,
              served_by: "mock",
              changed_db: Number(info.changes ?? 0) > 0,
            },
          } as unknown as D1Result;
        },
        // raw() rarely used — best-effort impl
        async raw() {
          const s = ensure();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          const rows = s.all(...(boundValues as never[]));
          return rows.map((r) => Object.values(r as object)) as unknown[][];
        },
      } as unknown as D1PreparedStatement;
      return wrapper;
    },

    async batch(statements: D1PreparedStatement[]) {
      const results: D1Result[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },

    async exec(query: string) {
      db.exec(query);
      return { count: 0, duration: 0 };
    },

    dump() {
      throw new Error("dump() not supported in mock");
    },
  };
  return adapter as D1Database;
}

/** Build a fresh KVNamespace-compatible mock backed by Map. */
export function createMockKv(): KVNamespace {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kv: any = {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      const entry: { value: string; expiresAt?: number } = { value };
      if (options?.expirationTtl) entry.expiresAt = Date.now() + options.expirationTtl * 1000;
      store.set(key, entry);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = "", limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
  return kv as KVNamespace;
}

/** Mock R2Bucket — stores blobs in Map. */
export function createMockR2(): R2Bucket {
  const store = new Map<string, { body: unknown; meta?: unknown }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r2: any = {
    async put(key: string, value: unknown, options?: { httpMetadata?: unknown }) {
      store.set(key, { body: value, meta: options?.httpMetadata });
      return { key, size: 0 };
    },
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        body: entry.body,
        async text() {
          return typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body);
        },
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = "" }: { prefix?: string } = {}) {
      const objects = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((key) => ({ key }));
      return { objects, truncated: false };
    },
  };
  return r2 as R2Bucket;
}
