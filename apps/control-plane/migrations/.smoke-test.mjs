// Smoke test: apply all migrations, then INSERT representative rows + verify
// referential integrity, CHECK constraints, and the retention trigger.
// Usage: node --experimental-sqlite apps/control-plane/migrations/.smoke-test.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");

// Apply migrations
for (const f of fs.readdirSync(__dirname).filter((f) => f.endsWith(".sql")).sort()) {
  db.exec(fs.readFileSync(path.join(__dirname, f), "utf-8"));
}

let passed = 0;
let failed = 0;
function expect(label, fn) {
  try {
    fn();
    console.log(`  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

console.log("Smoke tests:\n");

// 1. Insert a client with valid data
expect("insert clients row (valid)", () => {
  db.exec(`
    INSERT INTO clients (id, business_name, industry, subtype_schema, theme_preset, city, tier, status)
    VALUES ('clk_test', 'Ślusarz Kowalski', 'locksmith', 'Locksmith', 'craftsman', 'Rzeszów', 'starter', 'active');
  `);
});

// 2. Verify CHECK constraint on theme_preset
expect("reject invalid theme_preset", () => {
  let threw = false;
  try {
    db.exec(`
      INSERT INTO clients (id, business_name, industry, subtype_schema, theme_preset, city, tier)
      VALUES ('clk_bad', 'X', 'x', 'X', 'invalid_preset', 'X', 'starter');
    `);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected CHECK constraint to reject invalid theme_preset");
});

// 3. Verify CHECK constraint on tier
expect("reject invalid tier", () => {
  let threw = false;
  try {
    db.exec(`
      INSERT INTO clients (id, business_name, industry, subtype_schema, theme_preset, city, tier)
      VALUES ('clk_bad2', 'X', 'x', 'X', 'craftsman', 'X', 'enterprise');
    `);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected CHECK constraint to reject invalid tier");
});

// 4. Insert subscription FK'd to client
expect("insert subscription with FK", () => {
  db.exec(`
    INSERT INTO subscriptions (id, client_id, provider, external_id, monthly_amount_grosze, tier, status, modules_json)
    VALUES ('sub_1', 'clk_test', 'stripe', 'sub_stripe_xxx', 14900, 'starter', 'active', '[]');
  `);
});

// 5. FK violation: subscription to non-existent client
expect("reject subscription with bad FK", () => {
  let threw = false;
  try {
    db.exec(`
      INSERT INTO subscriptions (id, client_id, provider, external_id, monthly_amount_grosze, tier, status, modules_json)
      VALUES ('sub_bad', 'clk_nonexistent', 'stripe', 'sub_x', 100, 'starter', 'active', '[]');
    `);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected FK constraint to reject orphan subscription");
});

// 6. Insert lead (without delete_after — should be defaulted to now + 24mc)
expect("default delete_after is set to now + 24 months", () => {
  db.exec(`
    INSERT INTO leads (id, client_id, source, consent_processing)
    VALUES ('lead_1', 'clk_test', 'contact_form', 1);
  `);
  const row = db.prepare(`SELECT delete_after FROM leads WHERE id = 'lead_1'`).get();
  const expected = new Date();
  expected.setMonth(expected.getMonth() + 24);
  const expectedIso = expected.toISOString().slice(0, 10);
  if (row.delete_after !== expectedIso) {
    throw new Error(`Expected delete_after = ${expectedIso}, got ${row.delete_after}`);
  }
});

// 7. CASCADE: delete client → subscriptions, leads, etc. should follow
expect("ON DELETE CASCADE propagates", () => {
  db.exec(`DELETE FROM clients WHERE id = 'clk_test'`);
  const subs = db.prepare(`SELECT count(*) AS c FROM subscriptions`).get();
  const leads = db.prepare(`SELECT count(*) AS c FROM leads`).get();
  if (subs.c !== 0) throw new Error(`Expected 0 subscriptions after CASCADE, got ${subs.c}`);
  if (leads.c !== 0) throw new Error(`Expected 0 leads after CASCADE, got ${leads.c}`);
});

// 8. UNIQUE INDEX on (provider, external_event_id) for webhook idempotency
expect("webhook_events idempotency UNIQUE", () => {
  db.exec(`INSERT INTO webhook_events (source, external_event_id, event_type, status) VALUES ('stripe', 'evt_1', 'x', 'received')`);
  let threw = false;
  try {
    db.exec(`INSERT INTO webhook_events (source, external_event_id, event_type, status) VALUES ('stripe', 'evt_1', 'x', 'received')`);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected UNIQUE constraint to reject duplicate webhook event");
});

// 9. Consent log with all 4 Consent Mode v2 signals
expect("consent_log accepts all 4 signals", () => {
  db.exec(`INSERT INTO clients (id, business_name, industry, subtype_schema, theme_preset, city, tier) VALUES ('clk_c', 'X', 'x', 'X', 'craftsman', 'X', 'starter')`);
  db.exec(`
    INSERT INTO consent_log (
      client_id, visitor_id_hash, ad_storage, analytics_storage, ad_user_data, ad_personalization,
      consent_text_version, consent_text_hash, source
    )
    VALUES ('clk_c', 'abc', 'granted', 'granted', 'denied', 'denied', 'v1.2', 'hashhh', 'banner');
  `);
});

// 10. RODO request: deadline_at must be set
expect("rodo_requests insert with required deadline_at", () => {
  db.exec(`
    INSERT INTO rodo_requests (id, requester_email_hash, request_type, source, deadline_at)
    VALUES ('rodo_1', 'abc', 'erasure', 'email', '2026-06-18');
  `);
});

// 11. Secrets inventory: scope + type + client_id uniqueness
expect("secrets_inventory uniqueness across scope+type+client", () => {
  db.exec(`
    INSERT INTO secrets_inventory (id, secret_type, scope, kid, rotation_policy, status)
    VALUES ('sec_1', 'anthropic_api_key', 'shared', 'kid_v1', 'quarterly', 'active');
  `);
  let threw = false;
  try {
    db.exec(`
      INSERT INTO secrets_inventory (id, secret_type, scope, kid, rotation_policy, status)
      VALUES ('sec_2', 'anthropic_api_key', 'shared', 'kid_v2', 'quarterly', 'active');
    `);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected UNIQUE to prevent two active shared anthropic_api_key entries");
});

// 12. AI calls: minimum fields
expect("ai_calls insert with computed cost", () => {
  db.exec(`
    INSERT INTO ai_calls (client_id, caller, provider, model, input_tokens, output_tokens, cost_grosze, success)
    VALUES ('clk_c', 'blog_draft', 'anthropic', 'claude-sonnet-4-6', 5000, 1200, 234, 1);
  `);
});

// 13. schema_migrations seed values present
expect("schema_migrations seed rows present", () => {
  const row = db.prepare(`SELECT count(*) AS c FROM schema_migrations`).get();
  if (row.c !== 9) throw new Error(`Expected 9 schema_migrations rows, got ${row.c}`);
});

console.log();
console.log(`Result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
