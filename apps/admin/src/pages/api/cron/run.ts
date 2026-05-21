/**
 * POST /api/cron/run — admin-only proxy do hub /api/admin/cron/run-now.
 *
 * Operator klika button w /operations → ten endpoint czyta ADMIN_API_KEY z env (server-side)
 * i wysyła request do hub. Klucz NIE jest exponowany do przeglądarki.
 *
 * Auth: panel session admin (locals.user).
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { CRON_JOB_SLUGS, isAllowedCronJob } from "../../../lib/cron-jobs.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (!env?.HUB_BASE_URL || !env.ADMIN_API_KEY) {
    return json({ ok: false, error: "HUB_BASE_URL or ADMIN_API_KEY missing" }, 500);
  }
  if (!locals.user) return json({ ok: false, error: "Unauthorized" }, 401);

  let body: { job?: string };
  try { body = (await request.json()) as typeof body; } catch {
    return json({ ok: false, error: "Body must be JSON" }, 400);
  }
  if (!body.job || !isAllowedCronJob(body.job)) {
    return json({ ok: false, error: `job must be one of: ${CRON_JOB_SLUGS.join(", ")}` }, 400);
  }

  try {
    const res = await fetch(`${env.HUB_BASE_URL}/api/admin/cron/run-now`, {
      method: "POST",
      headers: {
        "X-BP-Admin-Key": env.ADMIN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job: body.job }),
    });
    const j = await res.json();
    return new Response(JSON.stringify(j), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "hub unreachable" }, 502);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
