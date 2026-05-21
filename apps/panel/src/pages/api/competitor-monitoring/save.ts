/**
 * POST /api/competitor-monitoring/save — save klient's competitor monitoring config.
 *
 * Body: { competitors: string[]; keywords: string[]; location_name?: string; location_code?: number }
 * Auth: panel session.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { isAddonActive } from "../../../lib/addons.ts";

export const prerender = false;

const MAX_COMPETITORS = 3;
const MAX_KEYWORDS = 10;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  // Re-check addon active — UI gate alone is bypassable
  if (!(await isAddonActive(env.DB, locals.client.id, "competitor_monitoring"))) {
    return json({ ok: false, error: "Addon 'competitor_monitoring' nieaktywny" }, 403);
  }

  let body: { competitors?: unknown; keywords?: unknown; location_name?: unknown; location_code?: unknown };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  const competitors = Array.isArray(body.competitors)
    ? (body.competitors as unknown[])
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
        .filter((c) => DOMAIN_RE.test(c))
        .slice(0, MAX_COMPETITORS)
    : [];

  const keywords = Array.isArray(body.keywords)
    ? (body.keywords as unknown[])
        .filter((k): k is string => typeof k === "string")
        .map((k) => k.trim())
        .filter((k) => k.length >= 2 && k.length <= 80)
        .slice(0, MAX_KEYWORDS)
    : [];

  if (keywords.length === 0) {
    return json({ ok: false, error: "Wymagane minimum 1 słowo kluczowe" }, 422);
  }

  const locationName = typeof body.location_name === "string" ? body.location_name : null;
  const locationCode = typeof body.location_code === "number" ? body.location_code : null;

  await env.DB
    .prepare(
      `INSERT INTO competitor_monitoring_config (client_id, competitor_domains_json, keywords_json, location_name, location_code, search_language)
       VALUES (?, ?, ?, ?, ?, 'pl')
       ON CONFLICT (client_id) DO UPDATE SET
         competitor_domains_json = excluded.competitor_domains_json,
         keywords_json = excluded.keywords_json,
         location_name = excluded.location_name,
         location_code = excluded.location_code`,
    )
    .bind(
      locals.client.id,
      JSON.stringify(competitors),
      JSON.stringify(keywords),
      locationName,
      locationCode,
    )
    .run();

  return json({ ok: true, competitors, keywords, location_name: locationName, location_code: locationCode }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
