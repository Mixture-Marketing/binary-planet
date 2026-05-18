/**
 * Shared test setup: builds a fresh mock D1 with mm-control-plane migrations applied,
 * seeds one admin_user + one client (referenced by leads/alerts tests).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createMockD1 } from "./d1-mock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// admin shares schema with control-plane — point at its migrations dir.
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "control-plane", "migrations");

export interface TestSetup {
  db: D1Database;
  adminUserId: string;
  adminEmail: string;
  clientId: string;
}

export async function setupTestDb(): Promise<TestSetup> {
  const db = createMockD1({ migrationsDir: MIGRATIONS_DIR });

  const adminUserId = "usr_test_admin";
  const adminEmail = "jakub@mixturemarketing.pl";
  await db
    .prepare(
      `INSERT INTO admin_users (id, email, display_name, role, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(adminUserId, adminEmail, "Jakub Test", "admin", "active")
    .run();

  const clientId = "clk_test";
  await db
    .prepare(
      `INSERT INTO clients (
         id, business_name, industry, subtype_schema, theme_preset, city, tier, status,
         primary_domain, feature_flags_json, modules_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      clientId,
      "Ślusarz Test",
      "locksmith",
      "Locksmith",
      "craftsman",
      "Rzeszów",
      "starter",
      "active",
      "test-locksmith.pl",
      "{}",
      '["care"]',
    )
    .run();

  return { db, adminUserId, adminEmail, clientId };
}

export async function insertLead(
  db: D1Database,
  clientId: string,
  overrides: { id?: string; source?: string; status?: string; is_hot?: number; estimated_value_pln?: number | null } = {},
): Promise<string> {
  const id = overrides.id ?? `lead_${Math.random().toString(36).slice(2, 10)}`;
  await db
    .prepare(
      `INSERT INTO leads (id, client_id, source, status, is_hot, estimated_value_pln, email_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      clientId,
      overrides.source ?? "contact_form",
      overrides.status ?? "new",
      overrides.is_hot ?? 0,
      overrides.estimated_value_pln ?? null,
      "hash_" + id,
    )
    .run();
  return id;
}

export async function insertAlert(
  db: D1Database,
  overrides: {
    id?: string;
    severity?: "P1" | "P2" | "P3" | "P4";
    alert_type?: string;
    title?: string;
    status?: "open" | "acked" | "resolved";
    client_id?: string | null;
  } = {},
): Promise<string> {
  const id = overrides.id ?? `alt_${Math.random().toString(36).slice(2, 10)}`;
  await db
    .prepare(
      `INSERT INTO alerts (id, severity, alert_type, client_id, title, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      overrides.severity ?? "P2",
      overrides.alert_type ?? "test_alert",
      overrides.client_id ?? null,
      overrides.title ?? "Test alert",
      overrides.status ?? "open",
    )
    .run();
  return id;
}
