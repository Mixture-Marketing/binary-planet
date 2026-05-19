/**
 * node:sqlite-backed D1 mock for tests. Mirrors apps/admin/test/d1-mock.ts.
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
  run(...values: unknown[]): { changes?: number | bigint; lastInsertRowid?: number | bigint };
}

export function createMockD1(options: { migrationsDir?: string } = {}): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  if (options.migrationsDir) {
    const files = fs.readdirSync(options.migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      db.exec(fs.readFileSync(path.join(options.migrationsDir, f), "utf-8"));
    }
  }
  return wrap(db);
}

function wrap(db: DatabaseSyncInstance): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter: any = {
    prepare(sql: string) {
      let stmt: StatementSync | null = null;
      const ensure = (): StatementSync => stmt ??= db.prepare(sql);
      let bound: unknown[] = [];
      const wrapper: D1PreparedStatement = {
        bind(...v: unknown[]) { bound = v; return wrapper; },
        async first<T = unknown>(_c?: string) {
          const r = ensure().get(...(bound as never[]));
          return (r === undefined ? null : r) as T | null;
        },
        async all<T = unknown>() {
          const rows = ensure().all(...(bound as never[]));
          return { results: rows as T[], success: true, meta: { duration: 0, changes: 0, last_row_id: 0, rows_read: rows.length, rows_written: 0, size_after: 0, served_by: "mock", changed_db: false } } as unknown as D1Result<T>;
        },
        async run() {
          const info = ensure().run(...(bound as never[]));
          return { results: [], success: true, meta: { duration: 0, changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0), rows_read: 0, rows_written: Number(info.changes ?? 0), size_after: 0, served_by: "mock", changed_db: Number(info.changes ?? 0) > 0 } } as unknown as D1Result;
        },
        async raw() {
          const rows = ensure().all(...(bound as never[]));
          return rows.map((r) => Object.values(r as object)) as unknown[][];
        },
      } as unknown as D1PreparedStatement;
      return wrapper;
    },
    async batch(stmts: D1PreparedStatement[]) {
      const out: D1Result[] = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    async exec(q: string) { db.exec(q); return { count: 0, duration: 0 }; },
    dump() { throw new Error("not supported"); },
  };
  return adapter as D1Database;
}
