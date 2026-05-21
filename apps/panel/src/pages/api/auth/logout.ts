import type { APIRoute } from "astro";

import {
  buildClearSessionCookie,
  readSessionCookie,
  revokeSession,
} from "../../../lib/auth.ts";
import { env } from "cloudflare:workers";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const sessionId = readSessionCookie(request.headers.get("Cookie"));
  if (env?.DB && sessionId) {
    await revokeSession(env.DB, sessionId).catch(() => undefined);
  }
  return new Response(null, {
    status: 302,
    headers: {
      "Set-Cookie": buildClearSessionCookie(true),
      Location: "/login",
    },
  });
};
