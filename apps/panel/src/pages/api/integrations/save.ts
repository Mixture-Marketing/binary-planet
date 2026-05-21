/**
 * POST /api/integrations/save — save delivery URL OR Google Place ID config.
 *
 * Body: { kind: "delivery"|"nfc"; url?: string; provider?: string; place_id?: string }
 * Auth: panel session.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { isAddonActive } from "../../../lib/addons.ts";

export const prerender = false;

const URL_RE = /^https:\/\/[\w.-]+\/[\w/?=&%.-]*$/i;
const DELIVERY_PROVIDERS = ["wolt.com", "glovoapp.com", "glovo.com", "pyszne.pl", "ubereats.com"];

// Map integration kind → required addon slug
const ADDON_MAP: Record<string, string> = {
  delivery: "wolt_glovo",
  nfc: "nfc_stand",
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: { kind?: string; url?: string; provider?: string; place_id?: string };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  // Re-check addon active for this kind
  const requiredAddon = body.kind ? ADDON_MAP[body.kind] : undefined;
  if (requiredAddon && !(await isAddonActive(env.DB, locals.client.id, requiredAddon))) {
    return json({ ok: false, error: `Addon '${requiredAddon}' nieaktywny` }, 403);
  }

  if (body.kind === "delivery") {
    if (!body.url || !URL_RE.test(body.url)) return json({ ok: false, error: "url invalid" }, 422);
    const host = body.url.replace(/^https:\/\//, "").split("/")[0]!.toLowerCase();
    if (!DELIVERY_PROVIDERS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return json({ ok: false, error: `Provider ${host} not allowed. Use: ${DELIVERY_PROVIDERS.join(", ")}` }, 422);
    }
    // Auto-detect provider from host
    let provider = body.provider ?? "generic";
    if (host.includes("wolt")) provider = "wolt";
    else if (host.includes("glovo")) provider = "glovo";
    else if (host.includes("pyszne")) provider = "pyszne";
    else if (host.includes("uber")) provider = "uber_eats";

    await env.DB
      .prepare(
        `INSERT INTO delivery_config (client_id, delivery_url, provider)
         VALUES (?, ?, ?)
         ON CONFLICT (client_id) DO UPDATE SET delivery_url = excluded.delivery_url, provider = excluded.provider, updated_at = datetime('now')`,
      )
      .bind(locals.client.id, body.url, provider)
      .run();
  } else if (body.kind === "nfc") {
    if (!body.place_id || body.place_id.length < 5) return json({ ok: false, error: "place_id required (Google Place ID)" }, 422);
    await env.DB
      .prepare(
        `INSERT INTO nfc_config (client_id, google_place_id)
         VALUES (?, ?)
         ON CONFLICT (client_id) DO UPDATE SET google_place_id = excluded.google_place_id, updated_at = datetime('now')`,
      )
      .bind(locals.client.id, body.place_id.trim())
      .run();
  } else {
    return json({ ok: false, error: "kind must be 'delivery' or 'nfc'" }, 400);
  }

  // Trigger rebuild
  let deploy: { ok: boolean; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/addons/deploy-trigger`, {
        method: "POST",
        headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: locals.client.id }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: { message?: string } };
      deploy = j.ok ? { ok: true } : { ok: false, error: j.error?.message };
    } catch (e) { deploy = { ok: false, error: e instanceof Error ? e.message : "hub unreachable" }; }
  }

  return json({ ok: true, kind: body.kind, deploy }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
