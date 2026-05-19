/**
 * OVH integration — domain registration + DNS records.
 *
 * Production: signs requests with HMAC-SHA1 using OVH_APP_SECRET + OVH_CONSUMER_KEY
 * per https://docs.ovh.com/gb/en/customer/first-steps-with-ovh-api/.
 *
 * Dry-run: returns deterministic stub result, logs the call.
 */

import type { Env } from "../env.js";

export interface OvhResult {
  ok: boolean;
  message: string;
  /** OVH order id when real call succeeded. */
  order_id?: string;
}

function dryRun(env: Env): boolean {
  return (env.PROVISIONING_DRY_RUN ?? "true").toLowerCase() === "true";
}

/** Register a domain in OVH for the klient. Defaults to 1-year .pl. */
export async function ovhRegisterDomain(
  env: Env,
  params: { domain: string; client_id: string },
): Promise<OvhResult> {
  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would register ${params.domain} for ${params.client_id}`,
      order_id: `dryrun-order-${Date.now()}`,
    };
  }
  if (!env.OVH_APP_KEY || !env.OVH_APP_SECRET || !env.OVH_CONSUMER_KEY) {
    return { ok: false, message: "OVH credentials missing — set OVH_APP_KEY/SECRET/CONSUMER_KEY" };
  }
  // Production implementation: POST /order/domain/zone (multi-step OVH order flow).
  // For now we leave this as TODO — full OVH order requires shopping cart endpoints
  // (POST /order/cart, POST /order/cart/{cartId}/domain, …) which is ~150 lines.
  // Tracked in Track 4-prod.
  return { ok: false, message: "OVH production registration not implemented yet (Track 4-prod)" };
}

/** Configure DNS for the registered domain → point to CF Worker. */
export async function ovhConfigureDns(
  env: Env,
  params: { domain: string; cname_target: string },
): Promise<OvhResult> {
  if (dryRun(env)) {
    return {
      ok: true,
      message: `[DRY-RUN] Would set ${params.domain} CNAME → ${params.cname_target}`,
    };
  }
  if (!env.OVH_APP_KEY) return { ok: false, message: "OVH credentials missing" };
  // Production: POST /domain/zone/{domain}/record { fieldType:'CNAME', subDomain:'', target:cname_target }
  // then POST /domain/zone/{domain}/refresh
  return { ok: false, message: "OVH DNS configuration not implemented yet (Track 4-prod)" };
}
