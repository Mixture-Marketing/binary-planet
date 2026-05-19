import type { APIRoute } from "astro";

import { triggerDryRunProvisioning } from "../../../lib/provisioning.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) return json({ ok: false, error: "Runtime not ready" }, 500);
  if (!locals.user) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: { client_id?: string };
  try {
    body = (await request.json()) as { client_id?: string };
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  if (!body.client_id) return json({ ok: false, error: "client_id required" }, 400);

  const result = await triggerDryRunProvisioning(env.DB, body.client_id);
  return json(result, result.ok ? 200 : 400);
};

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
