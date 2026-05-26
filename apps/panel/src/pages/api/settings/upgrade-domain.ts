/**
 * POST /api/settings/upgrade-domain
 *
 * Klient w trybie preview prosi o własną domenę. Proxy do hub'a:
 *   POST /api/admin/clients/{id}/upgrade-domain { domain, source: 'register'|'owned' }
 *
 * Hub:
 *   - Source 'register': OVH availability check → OVH register order → DNS configure → CF attach
 *   - Source 'owned': skip OVH register, configure DNS instructions for klient, CF attach
 *   - On success: UPDATE clients SET primary_domain = ?, preview_domain stays as backup
 *
 * Klient session required.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!env?.HUB_BASE_URL || !env.ADMIN_API_KEY) {
    return json({ ok: false, error: "Hub upgrade-domain not configured" }, 500);
  }

  let body: { domain?: string; source?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const domain = String(body.domain ?? "").trim().toLowerCase();
  const source = String(body.source ?? "register");
  if (!DOMAIN_RE.test(domain)) {
    return json({ ok: false, error: "Invalid domain format" }, 422);
  }
  if (source !== "register" && source !== "owned") {
    return json({ ok: false, error: "source must be 'register' or 'owned'" }, 422);
  }

  try {
    const hubRes = await fetch(
      `${env.HUB_BASE_URL}/api/admin/clients/${locals.client.id}/upgrade-domain`,
      {
        method: "POST",
        headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ domain, source }),
      },
    );
    const respBody = await hubRes.json();
    return new Response(JSON.stringify(respBody), {
      status: hubRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "hub unreachable" }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
