/**
 * POST /api/alerts/:id/snooze — snooze alert for N hours.
 *
 * Auth: admin or va.
 * Body: { hours: number } — default 24, max 168 (1 week).
 * Implementation: writes `snoozed_until` ISO into metadata_json + sets status='acked'.
 * Alert reappears as 'open' if cron fires again after snoozed_until.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, params }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  if (user.role !== "admin" && user.role !== "va") {
    return new Response(JSON.stringify({ error: "Insufficient role" }), {
      status: 403, headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing alert id" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  let body: { hours?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const hours = Math.min(Math.max(Number(body.hours ?? 24), 1), 168);
  const snoozedUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  // Fetch existing metadata_json
  const existing = await env.DB
    .prepare(`SELECT metadata_json FROM alerts WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<{ metadata_json: string | null }>();

  if (!existing) {
    return new Response(JSON.stringify({ error: "Alert not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  let metadata: Record<string, unknown> = {};
  if (existing.metadata_json) {
    try {
      metadata = JSON.parse(existing.metadata_json) as Record<string, unknown>;
    } catch {
      metadata = {};
    }
  }
  metadata.snoozed_until = snoozedUntil;
  metadata.snoozed_by = user.email;

  const result = await env.DB
    .prepare(
      `UPDATE alerts
          SET status = 'acked',
              acked_at = COALESCE(acked_at, ?),
              acked_by = COALESCE(acked_by, ?),
              metadata_json = ?
        WHERE id = ?`,
    )
    .bind(now, user.email, JSON.stringify(metadata), id)
    .run();

  if (!result.success) {
    return new Response(JSON.stringify({ error: "Database update failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, changed: true, snoozed_until: snoozedUntil }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
