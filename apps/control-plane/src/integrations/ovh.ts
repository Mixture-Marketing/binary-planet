/**
 * OVH integration — high-level operations for klient provisioning.
 *
 * Two paths:
 *   - dry-run (PROVISIONING_DRY_RUN=true) — returns stubs, no API calls
 *   - production — uses ovhRequest from ovh-client.ts (HMAC-SHA1 signed)
 *
 * Required env vars for production:
 *   OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY, OVH_ENDPOINT (default ovh-eu)
 *
 * Required OVH access rules (paste at https://eu.api.ovh.com/createToken/):
 *   GET    /me
 *   GET    /domain
 *   GET    /domain/*
 *   GET    /domain/zone
 *   GET    /domain/zone/*
 *   POST   /domain/zone/*
 *   PUT    /domain/zone/*
 *   DELETE /domain/zone/*
 *   GET    /order/cart/*
 *   POST   /order/cart
 *   POST   /order/cart/*
 */

import type { Env } from "../env.js";
import { ovhRequest, type OvhClientConfig } from "./ovh-client.js";

export interface OvhResult {
  ok: boolean;
  message: string;
  /** OVH order id when registration succeeded. */
  order_id?: string;
}

function dryRun(env: Env): boolean {
  return (env.PROVISIONING_DRY_RUN ?? "true").toLowerCase() === "true";
}

export function isTestMode(env: Env): boolean {
  return !dryRun(env) && (env.PROVISIONING_TEST_MODE ?? "").toLowerCase() === "true";
}

function clientFromEnv(env: Env): OvhClientConfig | null {
  if (!env.OVH_APP_KEY || !env.OVH_APP_SECRET || !env.OVH_CONSUMER_KEY) return null;
  return {
    appKey: env.OVH_APP_KEY,
    appSecret: env.OVH_APP_SECRET,
    consumerKey: env.OVH_CONSUMER_KEY,
    endpoint: env.OVH_ENDPOINT ?? "ovh-eu",
  };
}

// ---------------------------------------------------------------------------
// Credential verification — useful for local sanity check & monitoring
// ---------------------------------------------------------------------------

interface OvhMeResponse {
  nichandle: string;
  email?: string;
  country?: string;
}

/** Verify the configured OVH credentials by calling GET /me. */
export async function ovhVerifyCredentials(env: Env): Promise<OvhResult & { nichandle?: string }> {
  if (dryRun(env)) {
    return { ok: true, message: "[DRY-RUN] OVH credentials check skipped", nichandle: "dryrun" };
  }
  const cfg = clientFromEnv(env);
  if (!cfg) return { ok: false, message: "OVH credentials missing — set OVH_APP_KEY/SECRET/CONSUMER_KEY" };
  try {
    const me = await ovhRequest<OvhMeResponse>(cfg, "/me");
    return { ok: true, message: `OVH OK — logged as ${me.nichandle}`, nichandle: me.nichandle };
  } catch (e) {
    return { ok: false, message: `OVH /me failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

// ---------------------------------------------------------------------------
// Domain registration — shopping cart flow
// ---------------------------------------------------------------------------
//
// OVH multi-step:
//   1. POST /order/cart           → { cartId }
//   2. POST /order/cart/{id}/assign       (link cart to current nichandle)
//   3. POST /order/cart/{id}/domain       { domain, duration: 'P1Y' }
//   4. POST /order/cart/{id}/checkout     { autoPayWithPreferredPaymentMethod: true }
//
// Klient pays with PaymentMean configured on OVH account. For production:
//   - Add credit card / SEPA in OVH manager BEFORE first run
//   - OVH auto-charges the configured PaymentMean on checkout

interface OvhCart { cartId: string; expire?: string }
interface OvhCartItem { itemId: number }
interface OvhCheckout { orderId: number; url?: string }

// ---------------------------------------------------------------------------
// Domain availability probe — cart-without-checkout (no charge)
// ---------------------------------------------------------------------------

export interface OvhDomainAvailability {
  ok: boolean;
  message: string;
  domain: string;
  orderable: boolean;
  /** First-year total cost (after promo discounts), in OVH currency units. */
  price_first_year?: { value: number; currency: string; text?: string };
  /** Annual renewal cost. */
  price_renew?: { value: number; currency: string; text?: string };
  /** "normal" | "claim" | "sunrise" | "goldenTime" | "landrush" — domain phase. */
  phase?: string;
  raw_offers?: unknown;
}

interface OvhCartDomainOffer {
  orderable?: boolean;
  productId?: string;
  offerId?: string;
  phase?: string;
  duration?: string[];
  prices?: Array<{ label: string; price: { value: number; currencyCode: string; text?: string } }>;
}

/**
 * Check if a domain is available + get pricing WITHOUT purchasing.
 * Flow: create cart → assign → POST domain (adds item) → GET domain (price/availability) → DELETE cart.
 * Never calls /checkout = no charge.
 */
export async function ovhCheckDomainAvailability(
  env: Env,
  params: { domain: string },
): Promise<OvhDomainAvailability> {
  const baseResult: OvhDomainAvailability = {
    ok: false,
    message: "",
    domain: params.domain,
    orderable: false,
  };

  if (dryRun(env)) {
    return {
      ...baseResult,
      ok: true,
      message: `[DRY-RUN] Skipped OVH availability check for ${params.domain}`,
      orderable: true,
      price_first_year: { value: 0.99, currency: "EUR", text: "0.99 € (stub)" },
      price_renew: { value: 9.99, currency: "EUR", text: "9.99 € (stub)" },
    };
  }
  const cfg = clientFromEnv(env);
  if (!cfg) return { ...baseResult, message: "OVH credentials missing" };

  let cartId: string | undefined;
  try {
    const cart = await ovhRequest<OvhCart>(cfg, "/order/cart", {
      method: "POST",
      body: { ovhSubsidiary: "PL", description: `availability-check ${params.domain}` },
    });
    cartId = cart.cartId;

    await ovhRequest(cfg, `/order/cart/${cart.cartId}/assign`, { method: "POST" });

    // POST item — server may reject for unavailable domain (4xx)
    try {
      await ovhRequest<OvhCartItem>(cfg, `/order/cart/${cart.cartId}/domain`, {
        method: "POST",
        body: { domain: params.domain, duration: "P1Y" },
      });
    } catch (e) {
      // Domain not available — POST itself errors out
      return {
        ...baseResult,
        ok: true,
        message: `Domain ${params.domain} not available: ${e instanceof Error ? e.message : "unknown"}`,
        orderable: false,
      };
    }

    // GET offers — array of available phases/prices
    const offers = await ovhRequest<OvhCartDomainOffer[]>(
      cfg,
      `/order/cart/${cart.cartId}/domain?domain=${encodeURIComponent(params.domain)}`,
    );

    if (!Array.isArray(offers) || offers.length === 0) {
      return {
        ...baseResult,
        ok: true,
        message: `Domain ${params.domain} returned no offers`,
        orderable: false,
      };
    }

    const first = offers[0]!;
    const totalPrice = first.prices?.find((p) => p.label === "TOTAL")?.price;
    const renewPrice = first.prices?.find((p) => p.label === "RENEW")?.price;

    return {
      ...baseResult,
      ok: true,
      orderable: first.orderable ?? false,
      message: `Domain ${params.domain} ${first.orderable ? "AVAILABLE" : "unavailable"} (phase: ${first.phase ?? "?"})`,
      ...(totalPrice && { price_first_year: { value: totalPrice.value, currency: totalPrice.currencyCode, ...(totalPrice.text && { text: totalPrice.text }) } }),
      ...(renewPrice && { price_renew: { value: renewPrice.value, currency: renewPrice.currencyCode, ...(renewPrice.text && { text: renewPrice.text }) } }),
      ...(first.phase && { phase: first.phase }),
      raw_offers: offers,
    };
  } catch (e) {
    return { ...baseResult, message: `OVH availability check failed: ${e instanceof Error ? e.message : "unknown"}` };
  } finally {
    if (cartId) {
      try {
        await ovhRequest(cfg, `/order/cart/${cartId}`, { method: "DELETE" });
      } catch {
        // best-effort cleanup; cart auto-expires after ~24h anyway
      }
    }
  }
}

export async function ovhRegisterDomain(
  env: Env,
  params: { domain: string; client_id: string; durationYears?: number },
): Promise<OvhResult> {
  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would register ${params.domain} for ${params.client_id}`,
      order_id: `dryrun-order-${Date.now()}`,
    };
  }
  const cfg = clientFromEnv(env);
  if (!cfg) return { ok: false, message: "OVH credentials missing" };

  let cartId: string | undefined;
  try {
    const cart = await ovhRequest<OvhCart>(cfg, "/order/cart", {
      method: "POST",
      body: { ovhSubsidiary: "PL", description: `provision ${params.client_id}` },
    });
    cartId = cart.cartId;

    await ovhRequest(cfg, `/order/cart/${cart.cartId}/assign`, { method: "POST" });

    const item = await ovhRequest<OvhCartItem>(cfg, `/order/cart/${cart.cartId}/domain`, {
      method: "POST",
      body: {
        domain: params.domain,
        duration: `P${params.durationYears ?? 1}Y`,
      },
    });

    const checkout = await ovhRequest<OvhCheckout>(cfg, `/order/cart/${cart.cartId}/checkout`, {
      method: "POST",
      body: { autoPayWithPreferredPaymentMethod: true, waiveRetractationPeriod: true },
    });

    return {
      ok: true,
      message: `Domain ${params.domain} ordered (cart item ${item.itemId}, order ${checkout.orderId}). Order delivery 5-60min — poll status with ovhGetOrder.`,
      order_id: String(checkout.orderId),
    };
  } catch (e) {
    return { ok: false, message: friendlyOvhError(e, params.domain) };
  }
}

/**
 * Map OVH errors to friendly Polish messages.
 * Handles: payment required, race condition, IP restriction, generic.
 */
function friendlyOvhError(e: unknown, domain: string): string {
  if (!(e instanceof Error)) return `OVH register failed: unknown`;
  const msg = e.message;
  // 402 Payment Required (most common — no payment method on OVH account)
  if (/402|payment[\s_-]?required|no\s+payment\s+method|paymentMean/i.test(msg)) {
    return `OVH zakup ${domain} odrzucony: brak skonfigurowanej metody płatności na koncie OVH. Dodaj kartę w https://www.ovh.com/manager/#/dedicated/billing/payment.`;
  }
  // 409 Conflict / race
  if (/409|not\s+available|already\s+(taken|registered)/i.test(msg)) {
    return `Domena ${domain} stała się niedostępna podczas checkout (race condition). Wybierz inną.`;
  }
  // Insufficient funds
  if (/insufficient[\s_-]?fund|balance/i.test(msg)) {
    return `OVH: niewystarczające środki na koncie / karta odrzuciła obciążenie.`;
  }
  // IP restriction
  if (/IpRestriction|forbidden.*ip|whitelist/i.test(msg)) {
    return `OVH: ograniczenie IP — Worker hub nie jest w whitelist OVH. Sprawdź ustawienia API w panelu OVH.`;
  }
  // Auth
  if (/403|unauthorized|invalidCredentials|Forbidden/i.test(msg)) {
    return `OVH credentials niepoprawne lub wygasłe. Odnów Consumer Key.`;
  }
  return `OVH register ${domain} failed: ${msg.slice(0, 200)}`;
}

/**
 * Track 19b — Get OVH order status.
 * After ovhRegisterDomain returns an order_id, poll this endpoint every few minutes
 * until status is 'delivered' (success) or 'cancelled'/'notPaid' (failure).
 *
 * Status lifecycle: checking → toValidate → documentsRequested → delivered (or cancelled/notPaid)
 */
export interface OvhOrderStatus {
  orderId: number;
  date: string;
  url?: string;
  status: "checking" | "toValidate" | "documentsRequested" | "delivered" | "cancelled" | "notPaid" | "unknown";
  /** Human-friendly status in PL. */
  message: string;
  /** True if order finished (one way or another). */
  terminal: boolean;
}

export async function ovhGetOrder(env: Env, orderId: string | number): Promise<OvhOrderStatus> {
  if (dryRun(env)) {
    return {
      orderId: Number(orderId),
      date: new Date().toISOString(),
      status: "delivered",
      message: "[DRY-RUN] Order zawsze 'delivered'",
      terminal: true,
    };
  }
  const cfg = clientFromEnv(env);
  if (!cfg) {
    return { orderId: Number(orderId), date: "", status: "unknown", message: "OVH credentials missing", terminal: false };
  }
  try {
    // GET /me/order/{id} — basic info + status
    const order = await ovhRequest<{
      orderId: number;
      date: string;
      url?: string;
    }>(cfg, `/me/order/${orderId}`);

    const status = await ovhRequest<{ status: string; history?: Array<{ status: string; date: string }> }>(
      cfg,
      `/me/order/${orderId}/status`,
    );

    const normalized = normalizeOrderStatus(status.status);
    return {
      orderId: order.orderId,
      date: order.date,
      ...(order.url && { url: order.url }),
      status: normalized,
      message: orderStatusMessage(normalized),
      terminal: ["delivered", "cancelled", "notPaid"].includes(normalized),
    };
  } catch (e) {
    return {
      orderId: Number(orderId),
      date: "",
      status: "unknown",
      message: friendlyOvhError(e, `order ${orderId}`),
      terminal: false,
    };
  }
}

function normalizeOrderStatus(s: string): OvhOrderStatus["status"] {
  const k = s.toLowerCase();
  if (k.includes("deliver")) return "delivered";
  if (k.includes("cancel")) return "cancelled";
  if (k.includes("notpaid") || k.includes("unpaid")) return "notPaid";
  if (k.includes("document")) return "documentsRequested";
  if (k.includes("validate")) return "toValidate";
  if (k.includes("check")) return "checking";
  return "unknown";
}

function orderStatusMessage(s: OvhOrderStatus["status"]): string {
  switch (s) {
    case "checking": return "OVH przetwarza zamówienie";
    case "toValidate": return "Czeka na walidację (najczęściej email do klienta z linkiem aktywacyjnym)";
    case "documentsRequested": return "OVH żąda dokumentów (rzadkie dla .pl, częste dla .com.pl business)";
    case "delivered": return "Zamówienie dostarczone — domena aktywna";
    case "cancelled": return "Zamówienie anulowane";
    case "notPaid": return "Zamówienie nie opłacone — sprawdź metodę płatności";
    case "unknown": return "Nieznany status";
  }
}

// ---------------------------------------------------------------------------
// DNS — record management
// ---------------------------------------------------------------------------

interface OvhRecord { id: number; fieldType: string; subDomain: string; target: string; ttl: number }

/**
 * Configure DNS for a registered domain:
 *   - CNAME www → cname_target (cf workers.dev)
 *   - Refresh zone to apply
 *
 * Apex (root) is NOT set here — CF Workers custom-domain attach handles apex
 * once the domain points to CF nameservers OR uses CF for DNS.
 * v0.1 assumes klient brings standalone domain, sets CF as DNS later.
 */
export async function ovhConfigureDns(
  env: Env,
  params: { domain: string; cname_target: string },
): Promise<OvhResult> {
  if (dryRun(env)) {
    return { ok: true, message: `[DRY-RUN] Would set ${params.domain} CNAME -> ${params.cname_target}` };
  }
  const cfg = clientFromEnv(env);
  if (!cfg) return { ok: false, message: "OVH credentials missing" };

  try {
    await ovhRequest<OvhRecord>(cfg, `/domain/zone/${params.domain}/record`, {
      method: "POST",
      body: {
        fieldType: "CNAME",
        subDomain: "www",
        target: ensureTrailingDot(params.cname_target),
        ttl: 300,
      },
    });

    await ovhRequest(cfg, `/domain/zone/${params.domain}/refresh`, { method: "POST" });

    return { ok: true, message: `DNS configured for ${params.domain} (www CNAME → ${params.cname_target}, zone refreshed)` };
  } catch (e) {
    return { ok: false, message: `OVH DNS failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

function ensureTrailingDot(s: string): string {
  return s.endsWith(".") ? s : `${s}.`;
}
