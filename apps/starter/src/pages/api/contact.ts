/**
 * POST /api/contact — form handler.
 *
 * Wires web-core/forms createFormHandler() into Astro's API route convention.
 * All logic (validation, Turnstile, rate limit, hub sync, fallback queue, Resend email)
 * lives in web-core. This file is glue only.
 */

import { createFormHandler } from "@mixturemarketing/web-core/forms";
import type { APIRoute } from "astro";

import clientConfig from "../../client.config.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as { runtime?: { env?: Record<string, unknown> } })?.runtime?.env;
  if (!env) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Środowisko Workers nie jest dostępne (uruchom przez `wrangler dev`).",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const handler = createFormHandler({
    env: env as unknown as Parameters<typeof createFormHandler>[0]["env"],
    config: {
      clientId: clientConfig.clientId,
      businessName: clientConfig.business.name,
      notificationEmail:
        clientConfig.contact.notificationEmail ?? clientConfig.contact.email,
      contactPhone: clientConfig.contact.primaryPhone,
      primaryDomain: clientConfig.domain.primary,
      consentTextVersion: clientConfig.rodo.consentVersion,
      rateLimit: { submitsPerEmail: 3, submitsPerIp: 5, windowSec: 3600 },
      hub: { timeoutMs: 3000, maxRetries: 1 },
    },
  });

  return handler(request);
};

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      ok: false,
      error: "METHOD_NOT_ALLOWED",
      message: "POST only",
    }),
    { status: 405, headers: { "Content-Type": "application/json" } },
  );
