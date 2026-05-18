/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * Critical contract:
 *   1. Verify Stripe signature (HMAC-SHA256 over timestamp + body)
 *   2. Record in webhook_events for idempotency (UNIQUE on source + external_event_id)
 *   3. Dispatch on event_type — return 200 even for unknown types (else Stripe retries)
 *
 * v0.1: stub dispatchers — real implementations in Faza 3 (provisioning workflow).
 *
 * NOT auth-protected by X-BP-Client-Key — uses Stripe-Signature instead.
 *
 * Reference: runbooks/P1-stripe-webhook-failure.md
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { markWebhookFailed, markWebhookProcessed, recordWebhookReceived } from "../../../repos/webhook-events.js";
import { err, ok } from "../../lib/responses.js";

export const stripeWebhookRouter = new Hono<HonoEnv>();

interface StripeEvent {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
  created?: number;
}

stripeWebhookRouter.post("/", async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Configuration error — return 500 so Stripe retries and we get alerted.
    const log = c.get("logger");
    if (log) log.critical("stripe_webhook_secret_missing");
    return c.json(err("INTERNAL_ERROR", "Webhook handler misconfigured"), 500);
  }

  const sigHeader = c.req.header("Stripe-Signature");
  if (!sigHeader) {
    return c.json(err("WEBHOOK_SIGNATURE_INVALID", "Stripe-Signature header missing"), 400);
  }

  const rawBody = await c.req.text();

  const verified = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!verified) {
    return c.json(err("WEBHOOK_SIGNATURE_INVALID", "Stripe signature verification failed"), 401);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body is not valid JSON"), 400);
  }

  if (!event.id || !event.type) {
    return c.json(err("VALIDATION_ERROR", "Stripe event missing id or type"), 400);
  }

  const record = await recordWebhookReceived(c.env.DB, {
    source: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    signatureVerified: true,
  });

  if (record.isDuplicate) {
    // Already processed (or in-progress). Return 200 to stop Stripe retrying.
    return c.json(
      ok({ id: event.id }, { idempotent_replay: true, existing_status: record.existingStatus }),
      200,
    );
  }

  // Dispatch — v0.1 stubs
  try {
    await dispatchStripeEvent(c.env, event);
    await markWebhookProcessed(c.env.DB, record.id);
    return c.json(ok({ id: event.id }), 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "stripe dispatch failed";
    await markWebhookFailed(c.env.DB, record.id, message);
    // Return 500 → Stripe retries; eventually circuit breaks at Stripe's 7-day window.
    const log = c.get("logger");
    if (log) log.error("stripe_dispatch_failed", e instanceof Error ? e : new Error(String(e)), { event_id: event.id, type: event.type });
    return c.json(err("INTERNAL_ERROR", "Dispatch failed; will retry"), 500);
  }
});

// ---------------------------------------------------------------------------
// Stripe signature verification
// https://docs.stripe.com/webhooks/signatures
// ---------------------------------------------------------------------------

async function verifyStripeSignature(body: string, signatureHeader: string, secret: string): Promise<boolean> {
  // Header format: "t=<ts>,v1=<sig>,v0=<legacy_sig>,..."
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=", 2);
    if (!k || !v) continue;
    if (k === "t") timestamp = v;
    if (k === "v1") v1Signatures.push(v);
  }

  if (!timestamp || v1Signatures.length === 0) return false;

  // Tolerance: 5 minutes (replay protection)
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 300) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const computed = bufToHex(sig);

  // Constant-time compare against each declared v1 signature
  for (const v1 of v1Signatures) {
    if (timingSafeHexEqual(computed, v1)) return true;
  }
  return false;
}

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Dispatcher — v0.1 stubs. Real implementations in Faza 3.
// ---------------------------------------------------------------------------

async function dispatchStripeEvent(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      // TODO Faza 3: kick off provisioning workflow
      // - create client row (status='provisioning')
      // - create subscription row
      // - enqueue background_jobs[onboard_new_client]
      await env.DB.prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', 'stripe.checkout.completed', 'webhook_event', ?, 'info', ?)`,
      )
        .bind(event.id, JSON.stringify({ event_type: event.type }))
        .run();
      return;

    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "charge.refunded":
      // TODO Faza 3: update subscriptions / payments / invoices tables
      await env.DB.prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', ?, 'webhook_event', ?, 'info', ?)`,
      )
        .bind(`stripe.${event.type}`, event.id, JSON.stringify({ event_type: event.type }))
        .run();
      return;

    default:
      // Unknown but not an error — log and ack
      await env.DB.prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', 'stripe.unknown_event_type', 'webhook_event', ?, 'debug', ?)`,
      )
        .bind(event.id, JSON.stringify({ event_type: event.type }))
        .run();
      return;
  }
}
