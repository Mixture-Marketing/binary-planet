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
import {
  CLIENT_STATUS_FROM_STRIPE,
  recordStripePayment,
  updateSubscriptionLifecycle,
  upsertSubscriptionFromStripe,
} from "../../../repos/subscriptions.js";
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
// Dispatcher — Track 6 real implementations.
//
// checkout.session.completed:
//   - extract client_id from metadata (set when wizard creates the session)
//   - upsert subscriptions row
//   - flip clients.status to 'provisioning' (so Track 4 cron picks up the work)
//
// customer.subscription.updated / .deleted:
//   - sync status + cancel timestamps
//   - if canceled → clients.status='churned'
//   - if past_due → clients.status stays 'active' (grace period)
//   - if unpaid → clients.status='suspended'
//
// invoice.paid / .payment_failed:
//   - record payments row (idempotent via UNIQUE on provider+external_id)
//   - failed → emit audit_log (P2 alert in real cron)
// ---------------------------------------------------------------------------

interface StripeCheckoutSessionObject {
  id: string;
  customer?: string;
  subscription?: string;
  customer_details?: { email?: string };
  metadata?: { client_id?: string };
  amount_total?: number;
  currency?: string;
}

interface StripeSubscriptionObject {
  id: string;
  customer: string;
  status: string;
  metadata?: { client_id?: string };
  current_period_start?: number;
  current_period_end?: number;
  cancel_at?: number | null;
  canceled_at?: number | null;
  items?: { data?: Array<{ price?: { id?: string; unit_amount?: number; currency?: string } }> };
}

interface StripeInvoiceObject {
  id: string;
  customer?: string;
  subscription?: string | null;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  status?: string;
  status_transitions?: { paid_at?: number | null };
  metadata?: { client_id?: string };
  lines?: { data?: Array<{ metadata?: { client_id?: string }; price?: { id?: string } }> };
  last_finalization_error?: { message?: string };
}

function tierFromPriceId(env: import("../../../env.js").Env, priceId: string | undefined): "starter" | "standard" | "premium" | "professional" | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === env.STRIPE_PRICE_STANDARD) return "standard";
  if (priceId === env.STRIPE_PRICE_PREMIUM) return "premium";
  if (priceId === env.STRIPE_PRICE_PROFESSIONAL) return "professional";
  return null;
}

async function dispatchStripeEvent(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(env, event);
      return;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpserted(env, event);
      return;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(env, event);
      return;

    case "invoice.paid":
    case "invoice.payment_succeeded":
      await handleInvoicePaid(env, event);
      return;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(env, event);
      return;

    case "charge.refunded":
      // Audit only — refund flow handled manually in v0.1 (admin reconciles).
      await env.DB.prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', 'stripe.charge.refunded', 'webhook_event', ?, 'warn', ?)`,
      )
        .bind(event.id, JSON.stringify({ event_type: event.type }))
        .run();
      return;

    default:
      // Unknown event type — ack but log so we notice unexpected types in audit.
      await env.DB.prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', 'stripe.unknown_event_type', 'webhook_event', ?, 'debug', ?)`,
      )
        .bind(event.id, JSON.stringify({ event_type: event.type }))
        .run();
      return;
  }
}

async function handleCheckoutCompleted(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  const obj = event.data?.object as StripeCheckoutSessionObject | undefined;
  if (!obj) return;
  const clientId = obj.metadata?.client_id;
  if (!clientId) {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
       VALUES ('system', 'stripe.checkout.missing_client_id', 'webhook_event', ?, 'warn', ?)`,
    )
      .bind(event.id, JSON.stringify({ session_id: obj.id }))
      .run();
    return;
  }

  // Flip client to 'provisioning' — Track 4 cron picks it up (later, AFTER wizard done).
  // For now: status = 'provisioning' signals "paid but config incomplete — wait for wizard submit".
  await env.DB
    .prepare(`UPDATE clients SET status = 'provisioning' WHERE id = ? AND status IN ('pending')`)
    .bind(clientId)
    .run();

  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
       VALUES ('system', 'stripe.checkout.completed', 'client', ?, 'info', ?)`,
    )
    .bind(clientId, JSON.stringify({ session_id: obj.id, subscription_id: obj.subscription, customer_id: obj.customer }))
    .run();

  // Track 13: send onboarding email — klient gets link to finish wizard in panel klienta.
  await sendOnboardingEmail(env, clientId).catch((e) => {
    // eslint-disable-next-line no-console
    console.warn("onboarding email send failed:", e instanceof Error ? e.message : e);
  });
}

/**
 * Send "uzupełnij wizard" email after Stripe payment.
 * Klient receives link to panel.mixturemarketing.pl/onboarding (auto-login via magic link).
 */
async function sendOnboardingEmail(env: import("../../../env.js").Env, clientId: string): Promise<void> {
  if (!env.RESEND_API_KEY) return; // Skip in dev/test

  // Fetch klient info
  const row = await env.DB
    .prepare(
      `SELECT c.business_name, c.tier, cc.contact_email_enc
         FROM clients c LEFT JOIN client_contacts cc ON cc.client_id = c.id
        WHERE c.id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<{ business_name: string; tier: string; contact_email_enc: string | null }>();
  if (!row?.contact_email_enc) return;

  // v0.1: stored as "dev:plaintext" prefix
  const email = row.contact_email_enc.startsWith("dev:") ? row.contact_email_enc.slice(4) : row.contact_email_enc;
  const businessName = row.business_name;
  const panelLogin = "https://panel.mixturemarketing.pl/login";

  const tierLabel = {
    starter: "Starter (179 zł/mc)",
    standard: "Standard (249 zł/mc)",
    premium: "Premium (349 zł/mc)",
    professional: "Professional (549 zł/mc)",
  }[row.tier] ?? row.tier;

  const subject = `MixtureMarketing — uzupełnij dane swojej strony`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #047857; margin: 0 0 16px 0;">Dziękujemy za płatność!</h1>
      <p>Cześć,</p>
      <p>Twoje zamówienie pakietu <strong>${escapeHtml(tierLabel)}</strong> dla firmy <strong>${escapeHtml(businessName)}</strong> zostało opłacone.</p>
      <p><strong>Co dalej?</strong></p>
      <ol style="line-height: 1.7;">
        <li>Kliknij przycisk poniżej, aby zalogować się do panelu klienta</li>
        <li>Wypełnij 12-krokowy wizard (godziny otwarcia, usługi, domena, etc.) — zajmie 5-10 minut</li>
        <li>W ciągu 24h Twoja strona internetowa będzie gotowa</li>
        <li>Otrzymasz email z adresem strony + linkiem do panelu klienta</li>
      </ol>
      <p style="margin: 32px 0;">
        <a href="${panelLogin}" style="display: inline-block; background: #047857; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Zaloguj się do panelu</a>
      </p>
      <p style="color: #64748b; font-size: 14px;">
        Logowanie: wpisz ten adres email (<strong>${escapeHtml(email)}</strong>), wyślemy Ci jednorazowy link logowania. Wygaśnie po 15 minutach.
      </p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
      <p style="color: #64748b; font-size: 13px;">
        Masz pytania? Odpowiedz na tego maila lub napisz na <a href="mailto:info@mixturemarketing.pl">info@mixturemarketing.pl</a>.<br>
        MixtureMarketing · NIP wkrótce · Pisz po polsku 🇵🇱
      </p>
    </div>
  `;
  const text = `Dziękujemy za płatność!

Pakiet: ${tierLabel}
Firma: ${businessName}

Co dalej:
1. Zaloguj się do panelu klienta: ${panelLogin}
2. Wypełnij wizard onboardingu (5-10 minut)
3. W 24h Twoja strona będzie gotowa
4. Otrzymasz email z adresem strony

Logowanie magic-link: wpisz adres ${email} → otrzymasz jednorazowy link.

Pytania: info@mixturemarketing.pl
`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
      to: email,
      subject,
      html,
      text,
    }),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function handleSubscriptionUpserted(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return;
  const clientId = obj.metadata?.client_id;
  if (!clientId) return; // skip — pre-onboarding test subs

  const firstItem = obj.items?.data?.[0]?.price;
  const tier = tierFromPriceId(env, firstItem?.id);
  if (!tier) {
    // Unknown price — log + skip (could be a one-off addon)
    await env.DB.prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
       VALUES ('system', 'stripe.subscription.unknown_price', 'subscription', ?, 'warn', ?)`,
    )
      .bind(obj.id, JSON.stringify({ price_id: firstItem?.id }))
      .run();
    return;
  }

  const monthlyAmount = firstItem?.unit_amount ?? 0;
  const currency = (firstItem?.currency ?? "pln").toUpperCase();

  await upsertSubscriptionFromStripe(env.DB, {
    client_id: clientId,
    stripe_subscription_id: obj.id,
    stripe_customer_id: obj.customer,
    status: obj.status,
    tier,
    monthly_amount_grosze: monthlyAmount,
    currency,
    ...(obj.current_period_start !== undefined && { current_period_start_unix: obj.current_period_start }),
    ...(obj.current_period_end !== undefined && { current_period_end_unix: obj.current_period_end }),
    cancel_at_unix: obj.cancel_at ?? null,
    canceled_at_unix: obj.canceled_at ?? null,
  });

  const newClientStatus = CLIENT_STATUS_FROM_STRIPE[obj.status];
  if (newClientStatus) {
    // Don't overwrite 'provisioning' with 'active' — klient still needs to fill wizard
    // + have site deployed. Activation happens via deploy-notify (sets activated_at).
    if (newClientStatus === "active") {
      await env.DB
        .prepare(
          `UPDATE clients SET status = ? WHERE id = ? AND status NOT IN (?, 'provisioning', 'churned')`,
        )
        .bind(newClientStatus, clientId, newClientStatus)
        .run();
    } else {
      await env.DB
        .prepare(`UPDATE clients SET status = ? WHERE id = ? AND status != ?`)
        .bind(newClientStatus, clientId, newClientStatus)
        .run();
    }
  }

  // Track 22 B4 — Tier downgrade detection
  // If klient changed tier (e.g. Premium → Standard), enforce addons that no longer
  // belong to the new tier or that exceed allowed count.
  const existingTier = await env.DB
    .prepare(`SELECT tier FROM clients WHERE id = ? LIMIT 1`)
    .bind(clientId)
    .first<{ tier: string }>();
  if (existingTier && existingTier.tier !== tier) {
    await env.DB
      .prepare(`UPDATE clients SET tier = ? WHERE id = ?`)
      .bind(tier, clientId)
      .run();
    await env.DB
      .prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
         VALUES ('system', 'client.tier_change', 'client', ?, ?, 'info', ?)`,
      )
      .bind(clientId, clientId, JSON.stringify({ from: existingTier.tier, to: tier }))
      .run();
    try {
      const { enforceTierDowngrade } = await import("../../../scheduled/lifecycle.js");
      await enforceTierDowngrade(env, clientId, existingTier.tier, tier);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`tier_downgrade_pipeline failed for ${clientId}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function handleSubscriptionDeleted(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  const obj = event.data?.object as StripeSubscriptionObject | undefined;
  if (!obj) return;
  await updateSubscriptionLifecycle(env.DB, obj.id, {
    status: "canceled",
    canceled_at_unix: obj.canceled_at ?? Math.floor(Date.now() / 1000),
  });
  const clientId = obj.metadata?.client_id;
  if (clientId) {
    await env.DB
      .prepare(`UPDATE clients SET status = 'churned', churned_at = datetime('now') WHERE id = ?`)
      .bind(clientId)
      .run();

    // Track 22 — run full churn pipeline (archive repo, detach domain, cancel addons, send winback)
    try {
      const { executeChurnPipeline } = await import("../../../scheduled/lifecycle.js");
      await executeChurnPipeline(env, clientId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`churn_pipeline failed for ${clientId}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function handleInvoicePaid(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  const inv = event.data?.object as StripeInvoiceObject | undefined;
  if (!inv) return;
  const clientId = inv.metadata?.client_id ?? inv.lines?.data?.[0]?.metadata?.client_id ?? null;
  if (!clientId) return; // can't correlate

  // Look up internal subscription id by stripe sub id
  let internalSubId: string | null = null;
  if (inv.subscription) {
    const row = await env.DB
      .prepare(`SELECT id FROM subscriptions WHERE provider = 'stripe' AND external_id = ? LIMIT 1`)
      .bind(inv.subscription)
      .first<{ id: string }>();
    internalSubId = row?.id ?? null;
  }

  const amountGrosze = inv.amount_paid ?? 0;
  const currency = (inv.currency ?? "pln").toUpperCase();
  await recordStripePayment(env.DB, {
    client_id: clientId,
    subscription_id: internalSubId,
    stripe_invoice_id: inv.id,
    amount_grosze: amountGrosze,
    currency,
    status: "succeeded",
    paid_at_unix: inv.status_transitions?.paid_at ?? null,
  });

  // Look up internal payment.id we just created so invoice row can FK to it.
  const pmt = await env.DB
    .prepare(`SELECT id FROM payments WHERE provider = 'stripe' AND external_id = ? LIMIT 1`)
    .bind(inv.id)
    .first<{ id: string }>();

  // Generate Fakturownia VAT invoice (Track 7). Best-effort — failure here doesn't reject webhook.
  if (pmt) {
    try {
      const { generateMonthlyInvoice } = await import("../../../scheduled/fakturownia-invoice.js");
      await generateMonthlyInvoice(env, {
        client_id: clientId,
        payment_id: pmt.id,
        amount_grosze: amountGrosze,
        currency,
        external_payment_ref: inv.id,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Fakturownia generation failed for ${inv.id}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function handleInvoicePaymentFailed(env: import("../../../env.js").Env, event: StripeEvent): Promise<void> {
  const inv = event.data?.object as StripeInvoiceObject | undefined;
  if (!inv) return;
  const clientId = inv.metadata?.client_id ?? inv.lines?.data?.[0]?.metadata?.client_id ?? null;
  if (!clientId) return;

  let internalSubId: string | null = null;
  if (inv.subscription) {
    const row = await env.DB
      .prepare(`SELECT id FROM subscriptions WHERE provider = 'stripe' AND external_id = ? LIMIT 1`)
      .bind(inv.subscription)
      .first<{ id: string }>();
    internalSubId = row?.id ?? null;
  }

  await recordStripePayment(env.DB, {
    client_id: clientId,
    subscription_id: internalSubId,
    stripe_invoice_id: inv.id,
    amount_grosze: inv.amount_due ?? 0,
    currency: (inv.currency ?? "pln").toUpperCase(),
    status: "failed",
    failure_message: inv.last_finalization_error?.message ?? "payment failed",
  });

  // Audit so dunning cron picks this up tomorrow.
  await env.DB.prepare(
    `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
     VALUES ('system', 'stripe.invoice.payment_failed', 'client', ?, 'warn', ?)`,
  )
    .bind(clientId, JSON.stringify({ invoice_id: inv.id, subscription_id: inv.subscription }))
    .run();
}
