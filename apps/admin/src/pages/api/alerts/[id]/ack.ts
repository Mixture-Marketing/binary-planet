import type { APIRoute } from "astro";

import { ackAlert } from "../../../../lib/db.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.user) return json({ ok: false, error: "Unauthorized" }, 401);
  const id = params.id;
  if (!id) return json({ ok: false, error: "Missing alert id" }, 400);
  const ok = await ackAlert(env.DB, id, locals.user.email);
  return json({ ok, changed: ok }, ok ? 200 : 422);
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
