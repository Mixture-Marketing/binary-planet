/**
 * PATCH /api/leads/:id — klient updates lead status from panel.
 *
 * Auth: client_session cookie (middleware blocks unauth).
 * Body: { status: "new" | "contacted" | "qualified" | "won" | "lost" | "unqualified" | "spam" }
 * Returns: 200 { ok: true, status } or 4xx error.
 *
 * Ownership: verifies lead belongs to this client_id before mutation.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const ALLOWED_STATUSES = new Set([
  "new", "contacted", "qualified", "won", "lost", "unqualified", "spam",
]);

export const PATCH: APIRoute = async ({ request, locals, params }) => {
  const client = locals.client;
  if (!client) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (!env.DB) return new Response(JSON.stringify({ error: "Database not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });

  const id = params.id;
  if (!id) return new Response(JSON.stringify({ error: "Missing lead id" }), { status: 400, headers: { "Content-Type": "application/json" } });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const status = body.status;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: "Invalid status value" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Verify ownership + perform update in single SQL — anti-race
  const result = await env.DB
    .prepare(
      `UPDATE leads
          SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND client_id = ?`,
    )
    .bind(status, id, client.id)
    .run();

  if (!result.success) {
    return new Response(JSON.stringify({ error: "Database update failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  // D1 returns meta.changes — 0 means lead not found OR not owned by client
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) {
    return new Response(JSON.stringify({ error: "Lead not found or not owned by client" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
