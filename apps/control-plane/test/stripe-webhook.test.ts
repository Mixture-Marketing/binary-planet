import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv } from "./helpers.js";

const WEBHOOK_SECRET = "whsec_test_secret_abcdef123456";

async function signStripePayload(body: string, secret: string, timestamp?: number): Promise<string> {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payload = `${ts}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${ts},v1=${hex}`;
}

function stripeRequest(body: string, header: string): Request {
  return new Request("https://test/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": header,
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  it("200 on valid signature + known event", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(200);

    // Audit log recorded
    const audit = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM audit_log WHERE action = 'stripe.checkout.completed'`,
    ).first<{ c: number }>();
    expect(audit?.c).toBe(1);
  });

  it("401 on invalid signature", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({ id: "evt_x", type: "checkout.session.completed" });
    const res = await app.fetch(stripeRequest(body, "t=1,v1=deadbeef"), env);
    expect(res.status).toBe(401);
  });

  it("401 on stale timestamp (replay protection)", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const oldTs = Math.floor(Date.now() / 1000) - 600; // 10 min ago > 5 min tolerance
    const body = JSON.stringify({ id: "evt_stale", type: "checkout.session.completed" });
    const sig = await signStripePayload(body, WEBHOOK_SECRET, oldTs);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(401);
  });

  it("400 when Stripe-Signature header missing", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({ id: "evt_x", type: "x" });
    const res = await app.fetch(
      new Request("https://test/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("idempotency: same event id processed once", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_dedup_test",
      type: "checkout.session.completed",
      data: { object: {} },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);

    const r1 = await app.fetch(stripeRequest(body, sig), env);
    expect(r1.status).toBe(200);

    // Generate fresh signature with current timestamp for the retry
    const sig2 = await signStripePayload(body, WEBHOOK_SECRET);
    const r2 = await app.fetch(stripeRequest(body, sig2), env);
    expect(r2.status).toBe(200);
    const body2 = (await r2.json()) as { idempotent_replay?: boolean };
    expect(body2.idempotent_replay).toBe(true);

    // webhook_events should have one row
    const count = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM webhook_events WHERE external_event_id = 'evt_dedup_test'`,
    ).first<{ c: number }>();
    expect(count?.c).toBe(1);

    // audit_log only got one stripe.checkout.completed
    const audit = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM audit_log WHERE action = 'stripe.checkout.completed'`,
    ).first<{ c: number }>();
    expect(audit?.c).toBe(1);
  });
});
