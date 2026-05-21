import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv } from "./helpers.js";

const PUBLIC_KEY = "test-preonboard-key-public";

function postPreonboard(body: unknown, key?: string, ip = "1.2.3.4"): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "CF-Connecting-IP": ip,
  };
  if (key) headers["X-BP-Preonboard-Key"] = key;
  return new Request("https://test/api/admin/preonboard", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validBody = {
  business_name: "Ślusarz Kowalski",
  email: "kontakt@kowalski.pl",
  phone: "+48171234567",
  nip: "8121234567",
  tier: "standard",
  consent_marketing: true,
  consent_processing: true,
  consent_text_version: "v1.0",
};

describe("POST /api/admin/preonboard", () => {
  let env: Awaited<ReturnType<typeof setupTestEnv>>["env"];

  beforeEach(async () => {
    const setup = await setupTestEnv();
    env = setup.env;
    env.PREONBOARD_PUBLIC_KEY = PUBLIC_KEY;
  });

  it("returns 403 when PREONBOARD_PUBLIC_KEY not set", async () => {
    env.PREONBOARD_PUBLIC_KEY = undefined;
    const app = createApp();
    const res = await app.fetch(postPreonboard(validBody, "anything"), env);
    expect(res.status).toBe(403);
  });

  it("returns 401 when wrong key", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard(validBody, "wrong"), env);
    expect(res.status).toBe(401);
  });

  it("returns 422 for invalid email", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard({ ...validBody, email: "not-email" }, PUBLIC_KEY), env);
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain("email");
  });

  it("returns 422 for invalid NIP (9 digits)", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard({ ...validBody, nip: "812123456" }, PUBLIC_KEY), env);
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid phone (no E.164)", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard({ ...validBody, phone: "171234567" }, PUBLIC_KEY), env);
    expect(res.status).toBe(422);
  });

  it("returns 422 when consent_processing is false (RODO)", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard({ ...validBody, consent_processing: false }, PUBLIC_KEY), env);
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid tier", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard({ ...validBody, tier: "enterprise" }, PUBLIC_KEY), env);
    expect(res.status).toBe(422);
  });

  it("creates client + contact rows, returns client_id", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard(validBody, PUBLIC_KEY), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { client_id: string; already_exists: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.client_id).toMatch(/^clk_slusarz_kowalski_[a-z0-9]+$/);
    expect(body.data.already_exists).toBe(false);

    const client = await env.DB
      .prepare(`SELECT id, business_name, nip, tier, status FROM clients WHERE id = ?`)
      .bind(body.data.client_id)
      .first<{ id: string; business_name: string; nip: string; tier: string; status: string }>();
    expect(client?.business_name).toBe("Ślusarz Kowalski");
    expect(client?.nip).toBe("8121234567");
    expect(client?.tier).toBe("standard");
    expect(client?.status).toBe("pending");

    const contact = await env.DB
      .prepare(`SELECT contact_name, contact_email_hash FROM client_contacts WHERE client_id = ?`)
      .bind(body.data.client_id)
      .first<{ contact_name: string; contact_email_hash: string }>();
    expect(contact?.contact_email_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("idempotent: same email twice → returns same client_id with already_exists=true", async () => {
    const app = createApp();
    const r1 = await app.fetch(postPreonboard(validBody, PUBLIC_KEY, "1.1.1.1"), env);
    const b1 = (await r1.json()) as { data: { client_id: string; already_exists: boolean } };
    expect(b1.data.already_exists).toBe(false);

    const r2 = await app.fetch(postPreonboard({ ...validBody, business_name: "Other Name" }, PUBLIC_KEY, "1.1.1.2"), env);
    const b2 = (await r2.json()) as { data: { client_id: string; already_exists: boolean } };
    expect(b2.data.client_id).toBe(b1.data.client_id);
    expect(b2.data.already_exists).toBe(true);
  });

  it("audit log records preonboard.created with hashed ip", async () => {
    const app = createApp();
    const res = await app.fetch(postPreonboard(validBody, PUBLIC_KEY), env);
    const body = (await res.json()) as { data: { client_id: string } };

    const audit = await env.DB
      .prepare(`SELECT action, severity, metadata_json FROM audit_log WHERE resource_id = ? AND action = 'preonboard.created'`)
      .bind(body.data.client_id)
      .first<{ action: string; severity: string; metadata_json: string }>();
    expect(audit?.severity).toBe("info");
    const meta = JSON.parse(audit!.metadata_json) as { tier: string; ip_hash: string };
    expect(meta.tier).toBe("standard");
    expect(meta.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rate limit: 16th request from same IP returns 429", async () => {
    const app = createApp();
    const ip = "9.9.9.9";

    // 15 successful requests with different emails + different NIPs (NIP is UNIQUE).
    // RATE_LIMIT_MAX is 15/hour per IP — see preonboard.ts.
    for (let i = 0; i < 15; i++) {
      const res = await app.fetch(
        postPreonboard({ ...validBody, email: `user${i}@example.com`, nip: `12345678${String(i).padStart(2, "0")}` }, PUBLIC_KEY, ip),
        env,
      );
      expect(res.status, `request ${i + 1}/15 should succeed`).toBe(200);
    }

    // 16th hits rate limit
    const res16 = await app.fetch(
      postPreonboard({ ...validBody, email: "user16@example.com", nip: "1234567816" }, PUBLIC_KEY, ip),
      env,
    );
    expect(res16.status).toBe(429);
  });

  it("rate limit isolated per IP", async () => {
    const app = createApp();

    // Exhaust IP A — 15 successful + 1 over-limit (RATE_LIMIT_MAX = 15/hour)
    for (let i = 0; i < 15; i++) {
      await app.fetch(
        postPreonboard({ ...validBody, email: `a${i}@example.com`, nip: `22222222${String(i).padStart(2, "0")}` }, PUBLIC_KEY, "10.0.0.1"),
        env,
      );
    }
    const overflowA = await app.fetch(
      postPreonboard({ ...validBody, email: "blocked@example.com", nip: "2222222216" }, PUBLIC_KEY, "10.0.0.1"),
      env,
    );
    expect(overflowA.status).toBe(429);

    // IP B still works
    const okB = await app.fetch(
      postPreonboard({ ...validBody, email: "b@example.com", nip: "3333333330" }, PUBLIC_KEY, "10.0.0.2"),
      env,
    );
    expect(okB.status).toBe(200);
  });

  it("returns 500 on DB constraint violation (e.g. NIP collision with different email)", async () => {
    const app = createApp();
    // First request creates a klient with NIP 5555555555
    const r1 = await app.fetch(
      postPreonboard({ ...validBody, email: "a@example.com", nip: "5555555555" }, PUBLIC_KEY, "5.5.5.5"),
      env,
    );
    expect(r1.status).toBe(200);

    // Second request: different email (so passes idempotency check) but SAME NIP
    const r2 = await app.fetch(
      postPreonboard({ ...validBody, email: "b@example.com", nip: "5555555555" }, PUBLIC_KEY, "5.5.5.6"),
      env,
    );
    expect(r2.status).toBe(500);
    const body = (await r2.json()) as { error: { message: string } };
    expect(body.error.message.toLowerCase()).toContain("nip");
  });
});
