/**
 * POST /api/auth/logout
 * Revokes current session + clears cookie.
 */

import type { APIRoute } from "astro";

import { buildClearSessionCookie, readSessionCookie, revokeSession } from "../../../lib/auth.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  if (env?.DB) {
    const sessionId = readSessionCookie(request.headers.get("Cookie"));
    if (sessionId) {
      await revokeSession(env.DB, sessionId).catch(() => null);
    }
  }
  const secure = !import.meta.env.DEV;
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": buildClearSessionCookie(secure),
    },
  });
};
