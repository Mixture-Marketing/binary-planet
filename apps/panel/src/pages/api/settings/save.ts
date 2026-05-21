/**
 * POST /api/settings/save — klient samodzielnie edytuje swoje dane.
 *
 * Body: { kind: "contact" | "hours" | "hero"; ...fields... }
 *
 * Effect:
 *   - contact: update clients.* (phone via client_contacts, email change wymaga email confirm)
 *   - hours: update client_provisioning_configs.config_json hours object
 *   - hero: update client_provisioning_configs.config_json business.description/tagline
 *
 * Trigger klient site rebuild po update.
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const PHONE_RE = /^\+\d{8,15}$/;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.client) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: {
    kind?: string;
    phone?: string;
    description?: string;
    tagline?: string;
    hours?: Record<string, string>;
    preset?: string;
    variant?: string;
    heroVariant?: string;
    accent?: string;
    brandColor?: string;
    accentColor?: string;
    mode?: string;
    fontPairIdx?: number;
    services?: Array<{ slug: string; name: string; description: string; priceFrom?: string; iconKey?: string }>;
    sections?: Array<{ kind: string; enabled: boolean; config?: Record<string, unknown> }>;
  };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }

  if (body.kind === "contact") {
    if (!body.phone || !PHONE_RE.test(body.phone)) {
      return json({ ok: false, error: "Phone must be E.164 (+48...)" }, 422);
    }
    const phoneEnc = `dev:${body.phone}`;
    const phoneHash = await sha256Hex(body.phone);
    await env.DB
      .prepare(
        `UPDATE client_contacts SET contact_phone_enc = ?, contact_phone_hash = ?
          WHERE client_id = ?`,
      )
      .bind(phoneEnc, phoneHash, locals.client.id)
      .run();
  } else if (body.kind === "hero") {
    // Patch config_json business.description + business.tagline
    const row = await env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(locals.client.id)
      .first<{ config_json: string }>();
    if (!row) return json({ ok: false, error: "No config exists" }, 404);
    let config: { business?: { description?: string; tagline?: string } } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.business ??= {};
    if (body.description) config.business.description = body.description.slice(0, 500);
    if (body.tagline) config.business.tagline = body.tagline.slice(0, 180);
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
  } else if (body.kind === "hours") {
    if (!body.hours || typeof body.hours !== "object") {
      return json({ ok: false, error: "hours must be object {monday: '9:00-18:00', ...}" }, 422);
    }
    const row = await env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(locals.client.id)
      .first<{ config_json: string }>();
    if (!row) return json({ ok: false, error: "No config exists" }, 404);
    let config: { hours?: Record<string, string> } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.hours = { ...(config.hours ?? {}), ...body.hours };
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
  } else if (body.kind === "theme") {
    const VARIANTS: Record<string, readonly string[]> = {
      minimalist: ["mono-blue", "mono-black", "mono-emerald"],
      elegant: ["rose-cream", "sage-ivory", "mocha-blush"],
      dynamic: ["red-action", "electric-blue", "neon-noir"],
      editorial: ["forest-amber", "slate-rose", "cream-cobalt"],
    };
    const HEX = /^#[0-9a-fA-F]{6}$/;
    if (!body.preset || !VARIANTS[body.preset]) {
      return json({ ok: false, error: "preset must be minimalist|elegant|dynamic|editorial" }, 422);
    }
    if (!body.variant || !VARIANTS[body.preset]!.includes(body.variant)) {
      return json({ ok: false, error: `variant must be one of: ${VARIANTS[body.preset]!.join(", ")}` }, 422);
    }
    if (body.heroVariant && !["centered", "split", "image-bg", "asymmetric"].includes(body.heroVariant)) {
      return json({ ok: false, error: "heroVariant must be centered|split|image-bg|asymmetric" }, 422);
    }
    if (body.accent && !["bold", "soft", "outline"].includes(body.accent)) {
      return json({ ok: false, error: "accent must be bold|soft|outline" }, 422);
    }
    if (body.brandColor && !HEX.test(body.brandColor)) {
      return json({ ok: false, error: "brandColor must be #rrggbb hex" }, 422);
    }
    if (body.accentColor && !HEX.test(body.accentColor)) {
      return json({ ok: false, error: "accentColor must be #rrggbb hex" }, 422);
    }
    if (body.mode && !["auto", "light", "dark"].includes(body.mode)) {
      return json({ ok: false, error: "mode must be auto|light|dark" }, 422);
    }
    const fontPairIdx = typeof body.fontPairIdx === "number" ? Math.max(0, Math.min(5, body.fontPairIdx)) : 0;
    const row = await env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(locals.client.id)
      .first<{ config_json: string }>();
    if (!row) return json({ ok: false, error: "No config exists" }, 404);
    let config: { theme?: Record<string, string | number | undefined> } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.theme = {
      preset: body.preset,
      variant: body.variant,
      ...(body.heroVariant && { heroVariant: body.heroVariant }),
      ...(body.accent && { accent: body.accent }),
      ...(body.brandColor && { brandColor: body.brandColor }),
      ...(body.accentColor && { accentColor: body.accentColor }),
      mode: body.mode ?? "auto",
      fontPairIdx,
    };
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
    await env.DB
      .prepare(`UPDATE clients SET theme_preset = ?, theme_variant = ? WHERE id = ?`)
      .bind(body.preset, body.variant, locals.client.id)
      .run();
  } else if (body.kind === "services") {
    if (!Array.isArray(body.services) || body.services.length === 0) {
      return json({ ok: false, error: "services must be non-empty array" }, 422);
    }
    if (body.services.length > 8) {
      return json({ ok: false, error: "Max 8 services allowed" }, 422);
    }
    const SLUG = /^[a-z0-9-]+$/;
    const cleaned: Array<{ slug: string; name: string; description: string; priceFrom?: string; iconKey?: string }> = [];
    for (let i = 0; i < body.services.length; i++) {
      const s = body.services[i]!;
      if (!s.name || typeof s.name !== "string" || s.name.length < 1 || s.name.length > 120) {
        return json({ ok: false, error: `service[${i}].name must be 1-120 chars` }, 422);
      }
      if (!s.description || typeof s.description !== "string" || s.description.length < 1 || s.description.length > 500) {
        return json({ ok: false, error: `service[${i}].description must be 1-500 chars` }, 422);
      }
      if (!s.slug || !SLUG.test(s.slug)) {
        return json({ ok: false, error: `service[${i}].slug must match /^[a-z0-9-]+$/` }, 422);
      }
      if (s.priceFrom && (typeof s.priceFrom !== "string" || s.priceFrom.length > 40)) {
        return json({ ok: false, error: `service[${i}].priceFrom max 40 chars` }, 422);
      }
      if (s.iconKey && (typeof s.iconKey !== "string" || s.iconKey.length > 40)) {
        return json({ ok: false, error: `service[${i}].iconKey max 40 chars` }, 422);
      }
      const out: { slug: string; name: string; description: string; priceFrom?: string; iconKey?: string } = {
        slug: s.slug,
        name: s.name.trim(),
        description: s.description.trim(),
      };
      if (s.priceFrom?.trim()) out.priceFrom = s.priceFrom.trim();
      if (s.iconKey?.trim()) out.iconKey = s.iconKey.trim();
      cleaned.push(out);
    }
    // Reject duplicate slugs
    const slugs = cleaned.map((s) => s.slug);
    if (new Set(slugs).size !== slugs.length) {
      return json({ ok: false, error: "Duplicate slugs detected — each service must have unique slug" }, 422);
    }
    const row = await env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(locals.client.id)
      .first<{ config_json: string }>();
    if (!row) return json({ ok: false, error: "No config exists" }, 404);
    let config: { services?: unknown } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.services = cleaned;
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
  } else if (body.kind === "sections") {
    const ALLOWED_KINDS = [
      "pricing", "team", "history", "video", "gallery", "menu",
      "publications", "trust-badges", "consultation",
    ];
    if (!Array.isArray(body.sections)) {
      return json({ ok: false, error: "sections must be array" }, 422);
    }
    if (body.sections.length > 15) {
      return json({ ok: false, error: "Max 15 sections allowed" }, 422);
    }
    const cleaned: Array<{ kind: string; enabled: boolean; config?: Record<string, unknown> }> = [];
    const seenKinds = new Set<string>();
    for (let i = 0; i < body.sections.length; i++) {
      const s = body.sections[i]!;
      if (!s.kind || !ALLOWED_KINDS.includes(s.kind)) {
        return json({ ok: false, error: `sections[${i}].kind must be one of: ${ALLOWED_KINDS.join(", ")}` }, 422);
      }
      if (seenKinds.has(s.kind)) {
        return json({ ok: false, error: `Duplicate section kind: ${s.kind}` }, 422);
      }
      seenKinds.add(s.kind);
      if (typeof s.enabled !== "boolean") {
        return json({ ok: false, error: `sections[${i}].enabled must be boolean` }, 422);
      }
      // Per-kind config validation (loose — each component validates internally)
      let config: Record<string, unknown> | undefined = undefined;
      if (s.config && typeof s.config === "object") {
        config = s.config;
        // Light validation for video URL
        if (s.kind === "video" && typeof config.url === "string") {
          if (config.url.length > 500) {
            return json({ ok: false, error: `sections[${i}].config.url too long` }, 422);
          }
        }
      }
      cleaned.push({ kind: s.kind, enabled: s.enabled, ...(config && Object.keys(config).length > 0 && { config }) });
    }
    const row = await env.DB
      .prepare(`SELECT config_json FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
      .bind(locals.client.id)
      .first<{ config_json: string }>();
    if (!row) return json({ ok: false, error: "No config exists" }, 404);
    let config: { sections?: unknown } = {};
    try { config = JSON.parse(row.config_json); } catch { /* empty */ }
    config.sections = cleaned;
    await env.DB
      .prepare(`UPDATE client_provisioning_configs SET config_json = ? WHERE client_id = ?`)
      .bind(JSON.stringify(config), locals.client.id)
      .run();
  } else {
    return json({ ok: false, error: "kind must be contact|hero|hours|theme|services|sections" }, 400);
  }

  // Audit
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('klient', 'settings.update', 'client', ?, ?, 'info', ?)`,
    )
    .bind(locals.client.id, locals.client.id, JSON.stringify({ kind: body.kind }))
    .run();

  // Trigger rebuild (best-effort)
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    fetch(`${env.HUB_BASE_URL}/api/admin/addons/deploy-trigger`, {
      method: "POST",
      headers: { "X-BP-Admin-Key": env.ADMIN_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: locals.client.id }),
    }).catch(() => { /* swallow */ });
  }

  return json({ ok: true, kind: body.kind }, 200);
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
