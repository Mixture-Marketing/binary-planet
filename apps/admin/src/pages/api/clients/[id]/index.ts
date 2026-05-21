/**
 * PATCH /api/clients/:id — admin edits klient (tier, status, notes).
 *
 * Auth: admin or va role (read_only/billing_only blocked).
 * Body: { tier?: string; status?: string; notes?: string | null }
 * Returns: 200 { ok: true } or 4xx error.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const ALLOWED_TIERS = new Set(["starter", "standard", "premium", "professional"]);
const ALLOWED_STATUSES = new Set(["pending", "provisioning", "active", "paused", "churned"]);

export const PATCH: APIRoute = async ({ request, locals, params }) => {
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
    return new Response(JSON.stringify({ error: "Missing client_id" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  let body: { tier?: unknown; status?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  // Build dynamic UPDATE — only set provided fields
  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.tier !== undefined) {
    if (typeof body.tier !== "string" || !ALLOWED_TIERS.has(body.tier)) {
      return new Response(JSON.stringify({ error: "Invalid tier" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    updates.push("tier = ?");
    binds.push(body.tier);
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !ALLOWED_STATUSES.has(body.status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    updates.push("status = ?");
    binds.push(body.status);
  }
  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      return new Response(JSON.stringify({ error: "Invalid notes" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (typeof body.notes === "string" && body.notes.length > 2000) {
      return new Response(JSON.stringify({ error: "Notes too long (max 2000 chars)" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    updates.push("notes = ?");
    binds.push(body.notes);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  binds.push(id);
  const sql = `UPDATE clients SET ${updates.join(", ")} WHERE id = ?`;
  const result = await env.DB.prepare(sql).bind(...binds).run();

  if (!result.success) {
    return new Response(JSON.stringify({ error: "Database update failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) {
    return new Response(JSON.stringify({ error: "Client not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, updated: updates.length }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
};
