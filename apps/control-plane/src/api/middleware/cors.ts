/**
 * CORS middleware — allows marketing landing (mixturemarketing.pl) + admin panels
 * to call hub API from browser.
 *
 * Allowed origins (production):
 *   - https://mixturemarketing.pl     — marketing landing (Track 9 preonboard form)
 *   - https://www.mixturemarketing.pl — www variant
 *   - https://app.mixturemarketing.pl — admin panel
 *   - https://panel.mixturemarketing.pl — klient panel
 *
 * Dev:
 *   - http://localhost:4321  — starter dev
 *   - http://localhost:4322  — admin dev
 *   - http://localhost:4323  — panel dev
 *   - http://localhost:5173  — Vite (mixturemarketing.pl) default
 *   - http://localhost:3000  — Vite alt
 *
 * Allowed methods: GET, POST, OPTIONS
 * Allowed headers: Content-Type, X-BP-Client-Key, X-BP-Admin-Key,
 *                  X-BP-Preonboard-Key, X-Idempotency-Key
 *
 * Notes:
 *   - Webhooks (Stripe etc.) and Sveltia OAuth proxy use full-page redirects, not XHR,
 *     so they don't need CORS. Only XHR/fetch from browser needs this middleware.
 *   - We use `Access-Control-Allow-Origin: <specific origin>` not `*` because we send
 *     credentials (cookies, auth headers).
 */

import type { Context, MiddlewareHandler } from "hono";

import type { HonoEnv } from "../../env.js";

const PROD_ORIGINS = new Set([
  "https://mixturemarketing.pl",
  "https://www.mixturemarketing.pl",
  "https://app.mixturemarketing.pl",
  "https://panel.mixturemarketing.pl",
]);

const DEV_ORIGINS_REGEX = /^http:\/\/localhost:(4321|4322|4323|5173|3000|8787)$/;
/** CF Pages preview deploys for mixturemarketing.pl repo. */
const CF_PAGES_PREVIEW_REGEX = /^https:\/\/[a-z0-9-]+\.mixturemarketing-stona\.pages\.dev$/;

const ALLOWED_HEADERS = [
  "Content-Type",
  "X-BP-Client-Key",
  "X-BP-Admin-Key",
  "X-BP-Preonboard-Key",
  "X-Idempotency-Key",
  "Stripe-Signature",
].join(", ");

const ALLOWED_METHODS = "GET, POST, OPTIONS, PUT, DELETE";

function isAllowedOrigin(origin: string): boolean {
  return PROD_ORIGINS.has(origin)
    || DEV_ORIGINS_REGEX.test(origin)
    || CF_PAGES_PREVIEW_REGEX.test(origin);
}

export const corsMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const origin = c.req.header("Origin");

  // Not a CORS request (server-to-server, no Origin header)
  if (!origin) {
    return await next();
  }

  // Preflight (OPTIONS) — answer immediately without running route handler
  if (c.req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return c.text("CORS: origin not allowed", 403);
    }
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Actual request — let route handle it, then add CORS headers to response
  await next();

  if (isAllowedOrigin(origin)) {
    addCorsHeadersToResponse(c, origin);
  }
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // 24h preflight cache
    "Vary": "Origin",
  };
}

function addCorsHeadersToResponse(c: Context<HonoEnv>, origin: string): void {
  c.res.headers.set("Access-Control-Allow-Origin", origin);
  c.res.headers.set("Access-Control-Allow-Credentials", "true");
  c.res.headers.set("Vary", "Origin");
}
