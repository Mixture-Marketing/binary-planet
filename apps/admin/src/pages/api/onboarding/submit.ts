import type { APIRoute } from "astro";

import { createClientFromWizard, type OnboardingPayload } from "../../../lib/onboarding.ts";

export const prerender = false;

/**
 * POST /api/onboarding/submit
 * Body: OnboardingPayload (JSON)
 * Returns: { ok: true, clientId, redirect } | { ok: false, errors }
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime?.env;
  if (!env?.DB) {
    return new Response(JSON.stringify({ ok: false, error: "Runtime not ready" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!locals.user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: OnboardingPayload;
  try {
    payload = (await request.json()) as OnboardingPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await createClientFromWizard(env.DB, payload, locals.user.id);

  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, errors: result.errors }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, clientId: result.clientId, redirect: `/clients/${result.clientId}` }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
