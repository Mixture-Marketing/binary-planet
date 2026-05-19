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

  try {
    const cart = await ovhRequest<OvhCart>(cfg, "/order/cart", {
      method: "POST",
      body: { ovhSubsidiary: "PL", description: `provision ${params.client_id}` },
    });

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
      message: `Domain ${params.domain} ordered (cart item ${item.itemId}, order ${checkout.orderId})`,
      order_id: String(checkout.orderId),
    };
  } catch (e) {
    return { ok: false, message: `OVH register failed: ${e instanceof Error ? e.message : "unknown"}` };
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
