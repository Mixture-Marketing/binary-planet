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
  it("200 on valid signature + known event (no client_id metadata → missing_client_id audit)", async () => {
    const { env } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_test_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_no_meta" } },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(200);

    // Without client_id metadata, dispatcher logs missing_client_id audit.
    const audit = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM audit_log WHERE action = 'stripe.checkout.missing_client_id'`,
    ).first<{ c: number }>();
    expect(audit?.c).toBe(1);
  });

  it("checkout.session.completed with client_id → flips client to provisioning", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    // Reset status to 'pending' (helpers seeds 'active' — we need pre-provisioning state)
    await env.DB.prepare(`UPDATE clients SET status = 'pending' WHERE id = ?`).bind(clientId).run();
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_co_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_x",
          subscription: "sub_x",
          customer: "cus_x",
          metadata: { client_id: clientId },
        },
      },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(`SELECT status FROM clients WHERE id = ?`).bind(clientId).first<{ status: string }>();
    expect(row?.status).toBe("provisioning");
  });

  it("customer.subscription.updated → upserts subscriptions row + updates client status", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    env.STRIPE_PRICE_STANDARD = "price_standard_test";
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_sub_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_xyz",
          customer: "cus_xyz",
          status: "active",
          metadata: { client_id: clientId },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          items: { data: [{ price: { id: "price_standard_test", unit_amount: 19900, currency: "pln" } }] },
        },
      },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(200);

    const sub = await env.DB
      .prepare(`SELECT client_id, tier, status, monthly_amount_grosze, currency, external_id FROM subscriptions WHERE external_id = ?`)
      .bind("sub_xyz")
      .first<{ client_id: string; tier: string; status: string; monthly_amount_grosze: number; currency: string; external_id: string }>();
    expect(sub).toBeTruthy();
    expect(sub!.tier).toBe("standard");
    expect(sub!.status).toBe("active");
    expect(sub!.monthly_amount_grosze).toBe(19900);
    expect(sub!.currency).toBe("PLN");
    expect(sub!.client_id).toBe(clientId);
  });

  it("customer.subscription.updated with status=unpaid → suspends client", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    env.STRIPE_PRICE_STARTER = "price_starter_test";
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_sub_unpaid",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_unpaid",
          customer: "cus_unpaid",
          status: "unpaid",
          metadata: { client_id: clientId },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          items: { data: [{ price: { id: "price_starter_test", unit_amount: 14900, currency: "pln" } }] },
        },
      },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    await app.fetch(stripeRequest(body, sig), env);

    const c = await env.DB.prepare(`SELECT status FROM clients WHERE id = ?`).bind(clientId).first<{ status: string }>();
    expect(c?.status).toBe("suspended");
  });

  it("customer.subscription.deleted → marks subscription canceled + client churned", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    env.STRIPE_PRICE_STARTER = "price_starter_test";
    const app = createApp();

    // First create the subscription via an upsert event
    const createBody = JSON.stringify({
      id: "evt_sub_create",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_to_delete",
          customer: "cus_x",
          status: "active",
          metadata: { client_id: clientId },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
          items: { data: [{ price: { id: "price_starter_test", unit_amount: 14900, currency: "pln" } }] },
        },
      },
    });
    await app.fetch(stripeRequest(createBody, await signStripePayload(createBody, WEBHOOK_SECRET)), env);

    // Then delete
    const delBody = JSON.stringify({
      id: "evt_sub_del",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_to_delete",
          customer: "cus_x",
          status: "canceled",
          metadata: { client_id: clientId },
          canceled_at: 1700100000,
        },
      },
    });
    const res = await app.fetch(stripeRequest(delBody, await signStripePayload(delBody, WEBHOOK_SECRET)), env);
    expect(res.status).toBe(200);

    const sub = await env.DB
      .prepare(`SELECT status, canceled_at FROM subscriptions WHERE external_id = ?`)
      .bind("sub_to_delete")
      .first<{ status: string; canceled_at: string | null }>();
    expect(sub?.status).toBe("canceled");
    expect(sub?.canceled_at).toBeTruthy();

    const c = await env.DB.prepare(`SELECT status FROM clients WHERE id = ?`).bind(clientId).first<{ status: string }>();
    expect(c?.status).toBe("churned");
  });

  it("invoice.paid → records payment row idempotently", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_inv_paid",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_test_1",
          customer: "cus_test",
          subscription: "sub_unrelated", // no row yet → payment.subscription_id = null
          amount_paid: 19900,
          currency: "pln",
          status: "paid",
          status_transitions: { paid_at: 1700050000 },
          metadata: { client_id: clientId },
        },
      },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);

    const r1 = await app.fetch(stripeRequest(body, sig), env);
    expect(r1.status).toBe(200);

    const p = await env.DB
      .prepare(`SELECT client_id, amount_grosze, status, currency FROM payments WHERE provider = 'stripe' AND external_id = ?`)
      .bind("in_test_1")
      .first<{ client_id: string; amount_grosze: number; status: string; currency: string }>();
    expect(p).toBeTruthy();
    expect(p!.amount_grosze).toBe(19900);
    expect(p!.status).toBe("succeeded");
    expect(p!.currency).toBe("PLN");
  });

  it("invoice.payment_failed → audit_log warning + payments row status=failed", async () => {
    const { env, clientId } = await setupTestEnv();
    env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp();

    const body = JSON.stringify({
      id: "evt_inv_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_failed",
          customer: "cus_test",
          subscription: "sub_x",
          amount_due: 19900,
          currency: "pln",
          status: "open",
          metadata: { client_id: clientId },
          last_finalization_error: { message: "Card declined" },
        },
      },
    });
    const sig = await signStripePayload(body, WEBHOOK_SECRET);
    const res = await app.fetch(stripeRequest(body, sig), env);
    expect(res.status).toBe(200);

    const p = await env.DB
      .prepare(`SELECT status, failure_message FROM payments WHERE provider = 'stripe' AND external_id = ?`)
      .bind("in_test_failed")
      .first<{ status: string; failure_message: string | null }>();
    expect(p?.status).toBe("failed");
    expect(p?.failure_message).toBe("Card declined");

    const audit = await env.DB
      .prepare(`SELECT COUNT(*) AS c FROM audit_log WHERE action = 'stripe.invoice.payment_failed' AND resource_id = ?`)
      .bind(clientId)
      .first<{ c: number }>();
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

    // Without metadata, missing_client_id audit recorded — but only once thanks to idempotency.
    const audit = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM audit_log WHERE action = 'stripe.checkout.missing_client_id'`,
    ).first<{ c: number }>();
    expect(audit?.c).toBe(1);
  });
});
