/**
 * node:sqlite-backed D1Database mock for integration tests.
 *
 * Mirrors apps/control-plane/test/d1-mock.ts — copied (not imported) to avoid
 * cross-package test coupling. If divergence becomes painful, extract to a
 * test-utils workspace package.
 *
 * Requires Node ≥20.18 launched with --experimental-sqlite (see vitest.config.ts).
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

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
  migrationsDir?: string;
}

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

function wrapAsD1(db: DatabaseSyncInstance): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter: any = {
    prepare(sql: string) {
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
