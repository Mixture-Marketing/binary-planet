import { beforeEach, describe, expect, it } from "vitest";

import {
  getClient,
  getDashboardStats,
  listClients,
  listLeadsForClient,
  listOpenAlerts,
  listRecentLeads,
} from "../src/lib/db.ts";
import { insertAlert, insertLead, setupTestDb, type TestSetup } from "./helpers.js";

describe("db query helpers", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestDb();
  });

  describe("getDashboardStats", () => {
    it("counts clients, leads (today + week), and open alerts", async () => {
      // seeded: 1 active client
      await insertLead(setup.db, setup.clientId);
      await insertLead(setup.db, setup.clientId, { status: "won" });
      await insertAlert(setup.db, { status: "open" });
      await insertAlert(setup.db, { status: "acked" });
      await insertAlert(setup.db, { status: "resolved" }); // should not count

      const stats = await getDashboardStats(setup.db);
      expect(stats.totalClients).toBe(1);
      expect(stats.activeClients).toBe(1);
      expect(stats.leadsToday).toBe(2);
      expect(stats.leadsThisWeek).toBe(2);
      expect(stats.openAlerts).toBe(2);
    });

    it("excludes soft-deleted leads", async () => {
      const leadId = await insertLead(setup.db, setup.clientId);
      await setup.db
        .prepare(`UPDATE leads SET deleted_at = datetime('now') WHERE id = ?`)
        .bind(leadId)
        .run();
      const stats = await getDashboardStats(setup.db);
      expect(stats.leadsToday).toBe(0);
    });
  });

  describe("listClients", () => {
    it("returns the seeded client", async () => {
      const clients = await listClients(setup.db);
      expect(clients).toHaveLength(1);
      expect(clients[0]!.id).toBe(setup.clientId);
    });

    it("filters by status", async () => {
      await setup.db
        .prepare(
          `INSERT INTO clients (id, business_name, nip, industry, subtype_schema, theme_preset, city, tier, status, feature_flags_json, modules_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind("clk_paused", "Paused Co", "8121234568", "locksmith", "Locksmith", "craftsman", "Kraków", "starter", "paused", "{}", "[]")
        .run();

      const active = await listClients(setup.db, { status: "active" });
      const paused = await listClients(setup.db, { status: "paused" });
      expect(active).toHaveLength(1);
      expect(paused).toHaveLength(1);
      expect(paused[0]!.id).toBe("clk_paused");
    });

    it("respects limit", async () => {
      for (let i = 0; i < 3; i++) {
        await setup.db
          .prepare(
            `INSERT INTO clients (id, business_name, nip, industry, subtype_schema, theme_preset, city, tier, status, feature_flags_json, modules_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(`clk_${i}`, `Co ${i}`, `812123456${i}`, "locksmith", "Locksmith", "craftsman", "Kraków", "starter", "active", "{}", "[]")
          .run();
      }
      const limited = await listClients(setup.db, { limit: 2 });
      expect(limited).toHaveLength(2);
    });
  });

  describe("getClient", () => {
    it("returns full detail for a known id", async () => {
      const c = await getClient(setup.db, setup.clientId);
      expect(c).not.toBeNull();
      expect(c!.business_name).toBe("Ślusarz Test");
      expect(c!.theme_preset).toBe("craftsman");
      expect(c!.modules_json).toBe('["care"]');
    });

    it("returns null for unknown id", async () => {
      expect(await getClient(setup.db, "clk_does_not_exist")).toBeNull();
    });
  });

  describe("listLeadsForClient", () => {
    it("returns only this client's non-deleted leads, newest first", async () => {
      // Explicit created_at to make ordering deterministic (SQLite datetime('now') has second precision)
      await setup.db
        .prepare(
          `INSERT INTO leads (id, client_id, source, status, is_hot, email_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind("lead_a", setup.clientId, "contact_form", "new", 1, "h_a", "2026-05-19T10:00:00.000Z")
        .run();
      await setup.db
        .prepare(
          `INSERT INTO leads (id, client_id, source, status, is_hot, email_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind("lead_b", setup.clientId, "contact_form", "new", 0, "h_b", "2026-05-19T11:00:00.000Z")
        .run();

      const leads = await listLeadsForClient(setup.db, setup.clientId);
      expect(leads).toHaveLength(2);
      expect(leads[0]!.id).toBe("lead_b"); // newest first
    });

    it("excludes soft-deleted leads", async () => {
      await insertLead(setup.db, setup.clientId, { id: "lead_keep" });
      await insertLead(setup.db, setup.clientId, { id: "lead_gone" });
      await setup.db
        .prepare(`UPDATE leads SET deleted_at = datetime('now') WHERE id = ?`)
        .bind("lead_gone")
        .run();
      const leads = await listLeadsForClient(setup.db, setup.clientId);
      expect(leads.map((l) => l.id)).toEqual(["lead_keep"]);
    });
  });

  describe("listRecentLeads", () => {
    it("joins business_name from clients", async () => {
      await insertLead(setup.db, setup.clientId);
      const leads = await listRecentLeads(setup.db, 10);
      expect(leads).toHaveLength(1);
      expect(leads[0]!.business_name).toBe("Ślusarz Test");
    });
  });

  describe("listOpenAlerts", () => {
    it("returns open + acked, sorted by severity then fired_at DESC", async () => {
      await insertAlert(setup.db, { id: "alt_p3", severity: "P3", title: "p3" });
      await insertAlert(setup.db, { id: "alt_p1", severity: "P1", title: "p1" });
      await insertAlert(setup.db, { id: "alt_p2", severity: "P2", title: "p2" });
      await insertAlert(setup.db, { id: "alt_done", severity: "P1", status: "resolved" });

      const alerts = await listOpenAlerts(setup.db);
      expect(alerts.map((a) => a.id)).toEqual(["alt_p1", "alt_p2", "alt_p3"]);
    });

    it("respects limit", async () => {
      for (let i = 0; i < 5; i++) {
        await insertAlert(setup.db, { id: `alt_${i}`, title: `a${i}` });
      }
      const alerts = await listOpenAlerts(setup.db, 3);
      expect(alerts).toHaveLength(3);
    });
  });
});
