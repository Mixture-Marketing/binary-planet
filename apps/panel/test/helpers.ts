import path from "node:path";
import { fileURLToPath } from "node:url";

import { sha256Hex } from "../src/lib/auth.ts";
import { createMockD1 } from "./d1-mock.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "control-plane", "migrations");

export interface TestSetup {
  db: D1Database;
  clientId: string;
  clientEmail: string;
}

/** Seeds one active client + its client_contacts row with hashed email. */
export async function setupTestDb(): Promise<TestSetup> {
  const db = createMockD1({ migrationsDir: MIGRATIONS_DIR });

  const clientId = "clk_kowalski";
  const clientEmail = "kontakt@kowalski-slusarz.pl";

  await db
    .prepare(
      `INSERT INTO clients (id, business_name, nip, industry, subtype_schema, theme_preset, city, tier, status,
                            primary_domain, feature_flags_json, modules_json, activated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      clientId, "Ślusarz Kowalski", "8121234567", "locksmith", "Locksmith", "craftsman", "Rzeszów",
      "standard", "active", "kowalski-slusarz.pl", "{}", '["care"]', "2026-01-15T00:00:00.000Z",
    )
    .run();

  const emailHash = await sha256Hex(clientEmail.toLowerCase().trim());
  await db
    .prepare(
      `INSERT INTO client_contacts (client_id, contact_name, contact_email_enc, contact_email_hash)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(clientId, "Jan Kowalski", `dev:${clientEmail}`, emailHash)
    .run();

  return { db, clientId, clientEmail };
}

export async function seedLead(db: D1Database, clientId: string, overrides: { id?: string; status?: string; is_hot?: number; estimated_value_pln?: number | null } = {}): Promise<string> {
  const id = overrides.id ?? `lead_${Math.random().toString(36).slice(2, 10)}`;
  await db
    .prepare(
      `INSERT INTO leads (id, client_id, source, status, is_hot, estimated_value_pln, email_hash, consent_processing, consent_marketing)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, clientId, "contact_form", overrides.status ?? "new", overrides.is_hot ?? 0, overrides.estimated_value_pln ?? null, "h_" + id, 1, 0)
    .run();
  return id;
}
