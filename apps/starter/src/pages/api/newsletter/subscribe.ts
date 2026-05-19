/**
 * POST /api/newsletter/subscribe — klient site → hub proxy.
 *
 * Called by web-core/newsletter widget on klient site.
 * Forwards to hub /api/admin/newsletter/subscribe with X-BP-Client-Key.
 * Hub validates client_id + addon active + sends double opt-in email.
 *
 * Active only when NEWSLETTER_SMS_ENABLED=true (set by deploy-trigger when addon activated).
 */

import type { APIRoute } from "astro";

import clientConfig from "../../../client.config.ts";

export const prerender = false;

interface RuntimeEnv {
  NEWSLETTER_SMS_ENABLED?: string;
  HUB_BASE_URL?: string;
  BP_CLIENT_API_KEY?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: RuntimeEnv } })?.runtime?.env;
  if (!env) return json({ ok: false, error: "Runtime not available" }, 500);
  if ((env.NEWSLETTER_SMS_ENABLED ?? "").toLowerCase() !== "true") {
    return json({ ok: false, error: "Newsletter not enabled for this site" }, 403);
  }
  if (!env.HUB_BASE_URL || !env.BP_CLIENT_API_KEY) {
    return json({ ok: false, error: "Hub not configured" }, 500);
  }

  let body: { email?: string; phone?: string; source?: string; name?: string };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }
  if (!body.email) return json({ ok: false, error: "email required" }, 422);

  try {
    const res = await fetch(`${env.HUB_BASE_URL}/api/admin/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "X-BP-Client-Key": env.BP_CLIENT_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientConfig.clientId,
        email: body.email,
        phone: body.phone,
        name: body.name,
        source: body.source ?? "widget",
      }),
    });
    const hubJson = (await res.json()) as { ok?: boolean; data?: { id?: string; confirmation_sent?: boolean }; error?: { message?: string } };
    if (!hubJson.ok) return json({ ok: false, error: hubJson.error?.message ?? "subscribe failed" }, res.status);
    return json({ ok: true, confirmation_sent: hubJson.data?.confirmation_sent }, 200);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "hub unreachable" }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
