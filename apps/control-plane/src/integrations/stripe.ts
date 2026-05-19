/**
 * Stripe API client — minimal subset for Track 6 (subscription provisioning + reconciliation).
 *
 * Why no Stripe SDK: their Node SDK adds 200+ KB and uses node:net (Workers incompatible).
 * Direct REST is simpler and works on CF Workers runtime.
 *
 * Auth: Bearer secret key (STRIPE_SECRET_KEY).
 * Body format: application/x-www-form-urlencoded (Stripe convention).
 *
 * Endpoints we use:
 *   POST /v1/checkout/sessions       — create Checkout session for onboarding wizard
 *   GET  /v1/customers/{id}          — read customer (idempotent reconciliation)
 *   GET  /v1/subscriptions/{id}      — read subscription
 *   POST /v1/customers               — create customer (when wizard creates without checkout)
 *
 * Webhook events handled separately (signature verify lives in api/routes/webhooks/stripe.ts).
 */

const STRIPE_API_BASE = "https://api.stripe.com/v1";

export interface StripeClientConfig {
  secretKey: string;
  fetchImpl?: typeof fetch;
}

export interface StripeRequestError extends Error {
  status: number;
  body: string;
  stripeErrorCode?: string;
  stripeErrorType?: string;
}

function makeError(status: number, body: string): StripeRequestError {
  const err = new Error(`Stripe ${status}: ${body.slice(0, 250)}`) as StripeRequestError;
  err.status = status;
  err.body = body;
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; type?: string; message?: string } };
    if (parsed.error?.code) err.stripeErrorCode = parsed.error.code;
    if (parsed.error?.type) err.stripeErrorType = parsed.error.type;
    if (parsed.error?.message) err.message = `Stripe ${status}: ${parsed.error.message}`;
  } catch {
    /* not JSON */
  }
  return err;
}

/**
 * Encode object as Stripe's nested form syntax:
 *   { line_items: [{ price: "x", quantity: 1 }] }
 *   →  line_items[0][price]=x&line_items[0][quantity]=1
 */
export function encodeStripeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const fieldName = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          parts.push(encodeStripeForm(item as Record<string, unknown>, `${fieldName}[${idx}]`));
        } else {
          parts.push(`${encodeURIComponent(fieldName + "[" + idx + "]")}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(encodeStripeForm(value as Record<string, unknown>, fieldName));
    } else {
      parts.push(`${encodeURIComponent(fieldName)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export async function stripeRequest<T = unknown>(
  cfg: StripeClientConfig,
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<T> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const url = `${STRIPE_API_BASE}${path}`;
  const method = init.method ?? "GET";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.secretKey}`,
    "Stripe-Version": "2024-12-18.acacia",
  };
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;

  let body: string | undefined;
  if (init.body !== undefined && (method === "POST" || method === "DELETE")) {
    body = encodeStripeForm(init.body);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const res = await fetchImpl(url, { method, headers, ...(body !== undefined && { body }) });
  const text = await res.text();
  if (!res.ok) throw makeError(res.status, text);
  if (!text) return null as unknown as T;
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// High-level operations
// ---------------------------------------------------------------------------

export interface StripeAccount {
  id: string;
  business_profile?: { name?: string };
  email?: string;
  country?: string;
  charges_enabled?: boolean;
  details_submitted?: boolean;
}

/** GET /v1/account — verify the key works + tells us which account it's bound to. */
export async function getStripeAccount(cfg: StripeClientConfig): Promise<StripeAccount> {
  return await stripeRequest<StripeAccount>(cfg, "/account");
}

export interface StripePrice {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number; // grosze
  recurring?: { interval: string; interval_count: number };
}

/** GET /v1/prices/{id} — read a price (used in verify CLI to check tier IDs). */
export async function getStripePrice(cfg: StripeClientConfig, priceId: string): Promise<StripePrice> {
  return await stripeRequest<StripePrice>(cfg, `/prices/${priceId}`);
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer?: string;
  subscription?: string;
  status?: string;
  metadata?: Record<string, string>;
}

export interface CreateCheckoutInput {
  priceId: string;
  successUrl: string; // {CHECKOUT_SESSION_ID} placeholder allowed
  cancelUrl: string;
  /** Internal klient id — passed as metadata so we can correlate on webhook. */
  clientId: string;
  /** Pre-fill customer email. */
  customerEmail?: string;
  /** Existing Stripe customer id (skip email collection). */
  existingCustomerId?: string;
  /** Idempotency key — recommended. */
  idempotencyKey?: string;
}

/**
 * POST /v1/checkout/sessions — start hosted checkout for subscription.
 * Returns .url which the wizard redirects user to.
 */
export async function createCheckoutSession(
  cfg: StripeClientConfig,
  input: CreateCheckoutInput,
): Promise<StripeCheckoutSession> {
  const body: Record<string, unknown> = {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata: { client_id: input.clientId, source: "onboarding_wizard" },
    subscription_data: {
      metadata: { client_id: input.clientId },
    },
    allow_promotion_codes: true,
    locale: "pl",
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: false }, // Klient pays VAT via Fakturownia.pl side
  };
  if (input.customerEmail) body["customer_email"] = input.customerEmail;
  if (input.existingCustomerId) {
    body["customer"] = input.existingCustomerId;
    delete body["customer_email"];
  }

  const init: Parameters<typeof stripeRequest>[2] = {
    method: "POST",
    body,
  };
  if (input.idempotencyKey) init.idempotencyKey = input.idempotencyKey;

  return await stripeRequest<StripeCheckoutSession>(cfg, "/checkout/sessions", init);
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at?: number | null;
  canceled_at?: number | null;
  metadata?: Record<string, string>;
  items: { data: Array<{ price: { id: string; unit_amount: number; currency: string } }> };
}

export async function getStripeSubscription(cfg: StripeClientConfig, subscriptionId: string): Promise<StripeSubscription> {
  return await stripeRequest<StripeSubscription>(cfg, `/subscriptions/${subscriptionId}`);
}
