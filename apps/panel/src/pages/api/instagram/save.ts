/**
 * POST /api/instagram/save — save klient's Instagram embed config.
 *
 * Body: { embed_url?: string; embed_html?: string; display_count?: number; section_title?: string }
 * Auth: panel session.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { isAddonActive } from "../../../lib/addons.ts";

export const prerender = false;

const URL_RE = /^https:\/\/[\w.-]+\/[\w/?=&%.-]*$/i;
const ALLOWED_PROVIDERS = ["snapwidget.com", "lightwidget.com", "embedsocial.com", "elfsight.com", "instagram.com", "tagembed.com"];

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  // Re-check addon active — UI gate alone is bypassable
  if (!(await isAddonActive(env.DB, locals.client.id, "instagram_sync"))) {
    return json({ ok: false, error: "Addon 'instagram_sync' nieaktywny" }, 403);
  }

  let body: { embed_url?: string; embed_html?: string; display_count?: number; section_title?: string };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  let embed_url: string | null = null;
  let embed_html: string | null = null;
  let embed_type: "iframe_url" | "iframe_html" = "iframe_url";

  if (body.embed_url) {
    const trimmed = body.embed_url.trim();
    if (!URL_RE.test(trimmed)) return json({ ok: false, error: "embed_url must be HTTPS URL" }, 422);
    const host = trimmed.replace(/^https:\/\//, "").split("/")[0]!.toLowerCase();
    if (!ALLOWED_PROVIDERS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return json({ ok: false, error: `Provider ${host} not allowed. Use: ${ALLOWED_PROVIDERS.join(", ")}` }, 422);
    }
    embed_url = trimmed;
    embed_type = "iframe_url";
  } else if (body.embed_html) {
    const html = body.embed_html.trim();
    // Basic safety: only allow iframe tags from allowed providers
    if (!/^<iframe[\s\S]+<\/iframe>$/i.test(html)) {
      return json({ ok: false, error: "embed_html must be a single <iframe> tag" }, 422);
    }
    const srcMatch = html.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) return json({ ok: false, error: "iframe missing src=" }, 422);
    const host = srcMatch[1]!.replace(/^https?:\/\//, "").split("/")[0]!.toLowerCase();
    if (!ALLOWED_PROVIDERS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return json({ ok: false, error: `iframe src host ${host} not allowed` }, 422);
    }
    embed_html = html;
    embed_type = "iframe_html";
  } else {
    return json({ ok: false, error: "Provide either embed_url or embed_html" }, 422);
  }

  const displayCount = Math.max(3, Math.min(12, Number(body.display_count ?? 9)));
  const sectionTitle = (body.section_title ?? "Instagram").slice(0, 80);

  await env.DB
    .prepare(
      `INSERT INTO instagram_embed_config (client_id, embed_type, embed_url, embed_html, display_count, section_title)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (client_id) DO UPDATE SET
         embed_type = excluded.embed_type,
         embed_url = excluded.embed_url,
         embed_html = excluded.embed_html,
         display_count = excluded.display_count,
         section_title = excluded.section_title,
         updated_at = datetime('now')`,
    )
    .bind(locals.client.id, embed_type, embed_url, embed_html, displayCount, sectionTitle)
    .run();

  // Trigger klient site rebuild so widget reflects new config
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

  return json({ ok: true, embed_type, display_count: displayCount, deploy }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
