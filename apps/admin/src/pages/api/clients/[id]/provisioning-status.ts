/**
 * PATCH /api/clients/:id/provisioning-status — admin manual override.
 *
 * Auth: admin session (admin/va role) — middleware blocks anonymous + read_only/billing_only.
 * Body: { status: "pending" | "running" | "done" | "failed" }
 * Returns: 200 { ok: true } or 4xx error.
 *
 * Use case: when cron is down or provisioning hangs, admin sets the correct state.
 * Audit: provisioning_finished_at set to now() on transitions to done/failed.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const ALLOWED_STATUSES = new Set(["pending", "running", "done", "failed"]);

export const PATCH: APIRoute = async ({ request, locals, params }) => {
  const user = locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Only admin + va can mutate (read_only / billing_only — block)
  if (user.role !== "admin" && user.role !== "va") {
    return new Response(JSON.stringify({ error: "Insufficient role" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.DB) {
    return new Response(JSON.stringify({ error: "Database not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing client_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const status = body.status;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    return new Response(JSON.stringify({ error: "Invalid status value" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Update provisioning_status + audit timestamp on terminal states
  const finishedAt = (status === "done" || status === "failed") ? new Date().toISOString() : null;
  const result = await env.DB
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = ?,
              provisioning_finished_at = COALESCE(?, provisioning_finished_at)
        WHERE client_id = ?`,
    )
    .bind(status, finishedAt, id)
    .run();

  if (!result.success) {
    return new Response(JSON.stringify({ error: "Database update failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) {
    return new Response(JSON.stringify({ error: "Client provisioning config not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, status, finished_at: finishedAt }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
