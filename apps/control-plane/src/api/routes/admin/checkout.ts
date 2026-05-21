/**
 * POST /api/admin/stripe/checkout — create Stripe Checkout session for a klient.
 *
 * Called by mm-admin's onboarding wizard (last step) OR by mm-panel for tier upgrade.
 *
 * Body: { client_id: string, tier: "starter" | "standard" | "premium", success_path?: string, cancel_path?: string }
 * Returns: { url: string }  — admin redirects browser there
 *
 * Auth: X-BP-Admin-Key (separate from klient API keys — set as Worker secret).
 * v0.1 short-circuit: accept any caller from same-origin (admin and hub are siblings).
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { createCheckoutSession } from "../../../integrations/stripe.js";
import { err, ok } from "../../lib/responses.js";

export const adminCheckoutRouter = new Hono<HonoEnv>();

interface CreateCheckoutBody {
  client_id?: string;
  tier?: "starter" | "standard" | "premium" | "professional";
  success_path?: string;
  cancel_path?: string;
  customer_email?: string;
}

adminCheckoutRouter.post("/", async (c) => {
  const env = c.env;
  if (!env.STRIPE_SECRET_KEY) {
    return c.json(err("INTERNAL_ERROR", "Stripe not configured"), 500);
  }

  let body: CreateCheckoutBody;
  try {
    body = await c.req.json() as CreateCheckoutBody;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }

  if (!body.client_id) return c.json(err("VALIDATION_ERROR", "client_id required"), 400);
  if (!body.tier || !["starter", "standard", "premium", "professional"].includes(body.tier)) {
    return c.json(err("VALIDATION_ERROR", "tier must be starter|standard|premium|professional"), 400);
  }

  // Verify klient exists + status allows checkout
  const client = await env.DB
    .prepare(`SELECT id, business_name, status FROM clients WHERE id = ? LIMIT 1`)
    .bind(body.client_id)
    .first<{ id: string; business_name: string; status: string }>();
  if (!client) return c.json(err("NOT_FOUND", "Client not found"), 404);
  if (!["pending", "provisioning"].includes(client.status)) {
    return c.json(err("VALIDATION_ERROR", `Client status '${client.status}' — cannot start new checkout`), 409);
  }

  const priceId =
    body.tier === "starter" ? env.STRIPE_PRICE_STARTER :
    body.tier === "standard" ? env.STRIPE_PRICE_STANDARD :
    body.tier === "premium" ? env.STRIPE_PRICE_PREMIUM :
    env.STRIPE_PRICE_PROFESSIONAL;
  if (!priceId) {
    return c.json(err("INTERNAL_ERROR", `Stripe price ID for tier '${body.tier}' not configured`), 500);
  }

  const baseUrl = env.STRIPE_CHECKOUT_RETURN_URL ?? "https://app.mixturemarketing.pl";
  const successUrl = `${baseUrl}${body.success_path ?? `/clients/${body.client_id}?stripe=success&sid={CHECKOUT_SESSION_ID}`}`;
  const cancelUrl = `${baseUrl}${body.cancel_path ?? `/onboarding/${body.client_id}/config?stripe=canceled`}`;

  try {
    const checkoutInput: Parameters<typeof createCheckoutSession>[1] = {
      priceId,
      successUrl,
      cancelUrl,
      clientId: body.client_id,
      idempotencyKey: `checkout-${body.client_id}-${body.tier}-${Date.now()}`,
    };
    if (body.customer_email) checkoutInput.customerEmail = body.customer_email;

    const session = await createCheckoutSession({ secretKey: env.STRIPE_SECRET_KEY }, checkoutInput);

    return c.json(ok({ url: session.url, session_id: session.id }), 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe error";
    const log = c.get("logger");
    if (log) log.error("stripe_checkout_create_failed", e instanceof Error ? e : new Error(msg), { client_id: body.client_id });
    return c.json(err("INTERNAL_ERROR", `Stripe checkout failed: ${msg}`), 502);
  }
});
