import { beforeEach, describe, expect, it } from "vitest";

import {
  getClientContact,
  getClientFullConfig,
  getConsentSummary,
  getDashboardStats,
  listLeads,
} from "../src/lib/db.ts";
import { seedLead, setupTestDb, type TestSetup } from "./helpers.js";

describe("panel db helpers", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestDb();
  });

  it("getDashboardStats: scoped to client, counts won + hot + revenue", async () => {
    await seedLead(setup.db, setup.clientId);
    await seedLead(setup.db, setup.clientId, { is_hot: 1 });
    await seedLead(setup.db, setup.clientId, { status: "won", estimated_value_pln: 1500 });
    await seedLead(setup.db, setup.clientId, { status: "won", estimated_value_pln: 800 });

    const stats = await getDashboardStats(setup.db, setup.clientId);
    expect(stats.leadsToday).toBe(4);
    expect(stats.leadsThisWeek).toBe(4);
    expect(stats.hotLeads).toBe(1);
    expect(stats.wonLeads).toBe(2);
    expect(stats.estimatedRevenuePln).toBe(2300);
  });

  it("listLeads: returns only client's leads, newest first; respects status filter", async () => {
    // Seed a different client + lead to verify scoping
    await setup.db
      .prepare(`INSERT INTO clients (id, business_name, industry, subtype_schema, theme_preset, city, tier, status, feature_flags_json, modules_json)
                VALUES ('clk_other', 'Other', 'locksmith', 'Locksmith', 'craftsman', 'X', 'starter', 'active', '{}', '[]')`)
      .run();
    await seedLead(setup.db, "clk_other", { id: "lead_other" });

    await setup.db.prepare(`INSERT INTO leads (id, client_id, source, status, is_hot, email_hash, consent_processing, consent_marketing, created_at)
                              VALUES ('lead_a', ?, 'contact_form', 'new', 0, 'h_a', 1, 0, '2026-05-19T10:00:00.000Z')`).bind(setup.clientId).run();
    await setup.db.prepare(`INSERT INTO leads (id, client_id, source, status, is_hot, email_hash, consent_processing, consent_marketing, created_at)
                              VALUES ('lead_b', ?, 'contact_form', 'won', 0, 'h_b', 1, 0, '2026-05-19T11:00:00.000Z')`).bind(setup.clientId).run();

    const all = await listLeads(setup.db, setup.clientId);
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe("lead_b");
    expect(all.map((l) => l.id)).not.toContain("lead_other");

    const won = await listLeads(setup.db, setup.clientId, { status: "won" });
    expect(won.map((l) => l.id)).toEqual(["lead_b"]);
  });

  it("listLeads: ignores soft-deleted", async () => {
    const id = await seedLead(setup.db, setup.clientId);
    await setup.db.prepare(`UPDATE leads SET deleted_at = datetime('now') WHERE id = ?`).bind(id).run();
    expect(await listLeads(setup.db, setup.clientId)).toHaveLength(0);
  });

  it("getClientFullConfig returns row by id", async () => {
    const cfg = await getClientFullConfig(setup.db, setup.clientId);
    expect(cfg).not.toBeNull();
    expect(cfg!.business_name).toBe("Ślusarz Kowalski");
    expect(cfg!.tier).toBe("standard");
  });

  it("getClientFullConfig returns null for unknown id", async () => {
    expect(await getClientFullConfig(setup.db, "clk_does_not_exist")).toBeNull();
  });

  it("getClientContact returns hashed contact info", async () => {
    const c = await getClientContact(setup.db, setup.clientId);
    expect(c).not.toBeNull();
    expect(c!.contact_name).toBe("Jan Kowalski");
    expect(c!.contact_email_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("getConsentSummary aggregates marketing+processing counts", async () => {
    await seedLead(setup.db, setup.clientId);
    await seedLead(setup.db, setup.clientId);
    await setup.db.prepare(`UPDATE leads SET consent_marketing = 1 WHERE client_id = ?`).bind(setup.clientId).run();
    const s = await getConsentSummary(setup.db, setup.clientId);
    expect(s.total_leads).toBe(2);
    expect(s.consent_marketing_count).toBe(2);
    expect(s.consent_processing_count).toBe(2);
    expect(s.oldest_lead).toBeTruthy();
  });
});
