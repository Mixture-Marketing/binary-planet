/**
 * GET /api/onboarding/check-domain?domain=example.pl
 *
 * Klient-facing proxy to hub's /api/admin/ovh/check — used by onboarding wizard
 * to show domain price + availability inline before submit. Server-side proxy
 * because hub endpoint requires X-BP-Admin-Key (never exposed to browser).
 *
 * Auth: panel session cookie (Astro.locals.client set by middleware).
 *
 * Response shape (mirrors hub):
 *   { ok: true, data: { domain, available, price_first_year?: {value, currency}, price_renew?: ... } }
 *   { ok: false, error: "..." }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i;

export const GET: APIRoute = async ({ request, locals }) => {
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!env?.HUB_BASE_URL || !env.ADMIN_API_KEY) {
    return json({ ok: false, error: "Hub OVH check not configured (HUB_BASE_URL or ADMIN_API_KEY missing)" }, 500);
  }

  const url = new URL(request.url);
  const domain = url.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain || !DOMAIN_RE.test(domain)) {
    return json({ ok: false, error: "Invalid domain format" }, 400);
  }

  try {
    const hubRes = await fetch(`${env.HUB_BASE_URL}/api/admin/ovh/check?domain=${encodeURIComponent(domain)}`, {
      headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY },
    });
    const body = await hubRes.json();
    return new Response(JSON.stringify(body), {
      status: hubRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : "OVH check unreachable" },
      502,
    );
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
