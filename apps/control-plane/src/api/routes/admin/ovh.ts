/**
 * GET /api/admin/ovh/check?domain=example.pl
 *
 * Probes OVH domain availability + price WITHOUT purchasing (cart-without-checkout).
 * Useful for manually verifying OVH credentials work + sanity-checking a domain
 * before letting Track 14 provisioning auto-buy it.
 *
 * Auth: X-BP-Admin-Key == env.ADMIN_API_KEY.
 *
 * Response:
 *   { ok: true, data: { domain, orderable, price_first_year, price_renew, phase, message } }
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { ovhCheckDomainAvailability, ovhGetOrder, ovhVerifyCredentials } from "../../../integrations/ovh.js";
import { err, ok } from "../../lib/responses.js";

export const adminOvhRouter = new Hono<HonoEnv>();

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i;

function checkAuth(c: { req: { header(name: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "Admin endpoint disabled — set ADMIN_API_KEY";
  const got = c.req.header("X-BP-Admin-Key");
  if (got !== expected) return "Invalid or missing X-BP-Admin-Key";
  return null;
}

adminOvhRouter.get("/check", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const domain = c.req.query("domain")?.trim().toLowerCase();
  if (!domain || !DOMAIN_RE.test(domain)) {
    return c.json(err("VALIDATION_ERROR", "Query param ?domain= must be a valid domain (e.g. example.pl)"), 400);
  }

  const result = await ovhCheckDomainAvailability(c.env, { domain });
  if (!result.ok) {
    return c.json(err("INTERNAL_ERROR", result.message), 502);
  }
  // Heuristic: OVH cart returns price_first_year=0 + renew>0 when domain is TAKEN
  // (you can technically "add to cart" but the cart can't actually be checked out).
  // True availability = price_first_year > 0 OR no renewal price (rare).
  const likelyAvailable = (result.price_first_year?.value ?? 0) > 0;

  return c.json(ok({
    domain: result.domain,
    available: likelyAvailable,
    ovh_orderable_raw: result.orderable,
    message: likelyAvailable ? `Domain ${result.domain} AVAILABLE` : `Domain ${result.domain} likely TAKEN (no first-year price)`,
    ...(result.price_first_year && { price_first_year: result.price_first_year }),
    ...(result.price_renew && { price_renew: result.price_renew }),
    ...(result.phase && { phase: result.phase }),
  }), 200);
});

adminOvhRouter.get("/verify", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const result = await ovhVerifyCredentials(c.env);
  if (!result.ok) {
    return c.json(err("INTERNAL_ERROR", result.message), 502);
  }
  return c.json(ok({ message: result.message, nichandle: result.nichandle }), 200);
});

/**
 * GET /api/admin/ovh/order/:id — Track 19b: check status of a real OVH order.
 * Used by admin UI to verify a domain purchase is still in-flight, delivered, or cancelled.
 */
adminOvhRouter.get("/order/:id", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);
  const id = c.req.param("id");
  if (!id || !/^\d+$/.test(id)) return c.json(err("VALIDATION_ERROR", "order id must be numeric"), 400);
  const result = await ovhGetOrder(c.env, id);
  return c.json(ok(result), 200);
});
