/**
 * POST /api/clients/:id/retry-provisioning — operator manual retry.
 *
 * Effects:
 *   1. Reset client_provisioning_configs row to status='pending'
 *   2. Optionally trigger cron immediately via hub /api/admin/cron/run-now (if HUB_BASE_URL + ADMIN_API_KEY set)
 *   3. Audit log
 *
 * Auth: admin session cookie (Astro middleware sets Astro.locals.user).
 */

import type { APIRoute } from "astro";

import { resetProvisioning } from "../../../../lib/db.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: false, error: "Runtime not ready" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auth: rely on admin middleware setting locals.user (same as other admin pages).
  if (!locals.user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ ok: false, error: "Missing client id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const changed = await resetProvisioning(env.DB, id);
  if (!changed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No provisioning row to reset (already pending or doesn't exist)",
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES (?, 'admin.provisioning.retry', 'client', ?, ?, 'info', '{}')`,
    )
    .bind(locals.user.email ?? "admin", id, id)
    .run();

  // Best-effort: trigger cron immediately so operator doesn't wait up to 2 min for next tick.
  let triggered: { ok: boolean; processed?: number; failed?: number; error?: string } = { ok: false };
  if (env.HUB_BASE_URL && env.ADMIN_API_KEY) {
    try {
      const res = await fetch(`${env.HUB_BASE_URL}/api/admin/cron/run-now`, {
        method: "POST",
        headers: {
          "X-BP-Admin-Key": env.ADMIN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job: "provision_pending_2min" }),
      });
      const json = (await res.json()) as { ok?: boolean; data?: { processed?: number; failed?: number } };
      triggered = {
        ok: !!json.ok,
        processed: json.data?.processed,
        failed: json.data?.failed,
      };
    } catch (e) {
      triggered = { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
    }
  }

  return new Response(
    JSON.stringify({ ok: true, reset: true, triggered }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
