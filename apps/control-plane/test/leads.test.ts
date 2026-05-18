import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { jsonRequest, setupTestEnv } from "./helpers.js";

function makeTransportLead(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client_id: "clk_test",
    client_lead_id: "lead_abc123",
    spoke_received_at: "2026-05-18T12:00:00.000Z",
    source: "contact_form",
    email_hash: "a".repeat(64),
    consent_processing: 1,
    consent_marketing: 0,
    consent_text_version: "v1.0",
    consent_text_hash: "deadbeef",
    consent_at: "2026-05-18T12:00:00.000Z",
    ...overrides,
  };
}

describe("POST /api/leads", () => {
  it("201 on fresh insert", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("POST", "https://test/api/leads", makeTransportLead(), {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ok: boolean; data: { id: string }; duplicate?: boolean };
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("lead_abc123");
    expect(body.duplicate).toBe(false);

    // Verify row exists in D1
    const row = await env.DB.prepare(`SELECT id, client_id, source, email_hash FROM leads WHERE id = ?`)
      .bind("lead_abc123")
      .first<{ id: string; client_id: string; source: string; email_hash: string }>();
    expect(row).toBeTruthy();
    expect(row?.client_id).toBe("clk_test");
    expect(row?.source).toBe("contact_form");
  });

  it("200 idempotent replay (duplicate=true) on second insert with same client_lead_id", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();

    const r1 = await app.fetch(
      jsonRequest("POST", "https://test/api/leads", makeTransportLead(), {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(r1.status).toBe(201);

    const r2 = await app.fetch(
      jsonRequest("POST", "https://test/api/leads", makeTransportLead(), {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(r2.status).toBe(200);
    const body = (await r2.json()) as { duplicate: boolean };
    expect(body.duplicate).toBe(true);

    // Only one row total
    const count = await env.DB.prepare(`SELECT COUNT(*) AS c FROM leads`).first<{ c: number }>();
    expect(count?.c).toBe(1);
  });

  it("400 VALIDATION_ERROR on invalid email_hash format", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("POST", "https://test/api/leads", makeTransportLead({ email_hash: "not-hex" }), {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("email_hash");
  });

  it("400 on missing consent_processing", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const lead = makeTransportLead();
    delete (lead as Record<string, unknown>).consent_processing;
    const res = await app.fetch(
      jsonRequest("POST", "https://test/api/leads", lead, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("403 when client_id in body does not match authenticated key", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest(
        "POST",
        "https://test/api/leads",
        makeTransportLead({ client_id: "clk_someone_else" }),
        { "X-BP-Client-Key": apiKey },
      ),
      env,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("retention default fired (delete_after ~24 months ahead)", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    await app.fetch(
      jsonRequest("POST", "https://test/api/leads", makeTransportLead(), {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    const row = await env.DB.prepare(`SELECT delete_after FROM leads WHERE id = ?`)
      .bind("lead_abc123")
      .first<{ delete_after: string }>();
    expect(row?.delete_after).toBeTruthy();

    const expected = new Date();
    expected.setMonth(expected.getMonth() + 24);
    const expectedIso = expected.toISOString().slice(0, 10);
    expect(row?.delete_after).toBe(expectedIso);
  });

  it("rejects invalid JSON body", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://test/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-BP-Client-Key": apiKey },
        body: "not-json{{",
      }),
      env,
    );
    expect(res.status).toBe(400);
  });
});
