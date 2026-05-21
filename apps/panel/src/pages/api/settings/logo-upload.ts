/**
 * POST /api/settings/logo-upload — klient wgrywa logo firmy.
 *
 * Body: multipart/form-data, pole "logo" (File, max 500KB, image/png|jpeg|svg+xml|webp).
 *
 * Effect:
 *   1. Walidacja typu + rozmiaru
 *   2. Upload do R2 (`mm-uploads`) pod kluczem `logos/{client_id}.{ext}` (nadpisuje poprzednie)
 *   3. Update config_json.theme.logoUrl = `/api/logo/{client_id}?v={timestamp}` (cache-bust)
 *   4. Audit log + trigger rebuild
 *
 * Auth: panel session.
 *
 * Returns: { ok, logoUrl, sizeBytes, contentType }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const MAX_BYTES = 500 * 1024; // 500 KB
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB || !env.UPLOADS) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  const form = await request.formData();
  const file = form.get("logo");
  if (!(file instanceof File)) return json({ ok: false, error: "logo file missing" }, 422);
  if (file.size > MAX_BYTES) {
    return json({ ok: false, error: `Logo too large (${file.size} bytes, max ${MAX_BYTES})` }, 422);
  }
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return json({ ok: false, error: `Type ${file.type} not allowed. Use PNG/JPG/SVG/WEBP.` }, 422);
  }

  const key = `logos/${locals.client.id}.${ext}`;
  const buf = await file.arrayBuffer();
  await env.UPLOADS.put(key, buf, {
    httpMetadata: { contentType: file.type, cacheControl: "public, max-age=3600" },
    customMetadata: { clientId: locals.client.id, uploadedAt: new Date().toISOString() },
  });

  // Cleanup other extensions (klient may have re-uploaded with different format)
  for (const otherExt of Object.values(ALLOWED_TYPES)) {
    if (otherExt !== ext) {
      const otherKey = `logos/${locals.client.id}.${otherExt}`;
      await env.UPLOADS.delete(otherKey).catch(() => { /* ignore */ });
    }
  }

  // Update config_json.theme.logoUrl with cache-bust query
  const ts = Date.now();
  const logoUrl = `https://panel.mixturemarketing.pl/api/logo/${locals.client.id}?v=${ts}`;
  const row = await env.DB
    .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
    .bind(locals.client.id)
    .first<{ config_json: string }>();
  if (row) {
    let config: { theme?: Record<string, string | undefined> } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.theme = { ...(config.theme ?? {}), logoUrl };
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
  }

  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('klient', 'logo.upload', 'client', ?, ?, 'info', ?)`,
    )
    .bind(locals.client.id, locals.client.id, JSON.stringify({ key, size: file.size, type: file.type }))
    .run();

  // Trigger rebuild (best-effort)
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    fetch(`${env.HUB_BASE_URL}/api/admin/addons/deploy-trigger`, {
      method: "POST",
      headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: locals.client.id }),
    }).catch(() => { /* swallow */ });
  }

  return json({ ok: true, logoUrl, sizeBytes: file.size, contentType: file.type }, 200);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
