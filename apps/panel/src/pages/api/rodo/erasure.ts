/**
 * POST /api/rodo/erasure — klient zgłasza usunięcie danych osoby fizycznej (lead).
 *
 * Realizuje art. 17 RODO ("prawo do bycia zapomnianym") dla leadów klienta.
 *
 * Effect:
 *   1. Find leads matching email_hash for this client_id
 *   2. Anonimize: wipe encrypted fields (email_enc, phone_enc, name, message), keep hash for dedup
 *   3. Mark leads.erased_at = now() + reason
 *   4. Audit log entry
 *
 * Auth: panel session.
 *
 * Returns: { ok, erased_count, audit_id }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.DB) return new Response("Runtime not ready", { status: 500 });
  if (!locals.client) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 500);

  if (!email || !email.includes("@")) {
    return Response.redirect(`${new URL(request.url).origin}/rodo?error=invalid_email`, 302);
  }

  const emailHash = await sha256Hex(email);

  // Find + anonimize matching leads for this klient
  const res = await env.DB
    .prepare(
      `UPDATE leads
          SET email_enc = NULL,
              phone_enc = NULL,
              name_enc = NULL,
              message_enc = NULL,
              deleted_at = datetime('now'),
              deletion_reason = ?
        WHERE client_id = ?
          AND email_hash = ?
          AND deleted_at IS NULL`,
    )
    .bind(reason || "RODO Art. 17 — klient request", locals.client.id, emailHash)
    .run();

  const erasedCount = Number(res.meta?.changes ?? 0);

  // Audit log
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('klient', 'rodo.erasure_request', 'lead', ?, ?, 'info', ?)`,
    )
    .bind(emailHash, locals.client.id, JSON.stringify({ erased_count: erasedCount, reason, email_hash: emailHash }))
    .run();

  const url = new URL(request.url).origin;
  return Response.redirect(`${url}/rodo?erased=${erasedCount}`, 302);
};
