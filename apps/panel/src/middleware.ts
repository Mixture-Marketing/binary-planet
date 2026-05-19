/**
 * Astro middleware — auth gate + security headers for klient panel.
 *
 * Public paths: /login*, /api/auth/*, static assets.
 * Everything else: load `client` from cookie OR redirect to /login?next=...
 */

import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";
import { defineMiddleware } from "astro:middleware";

import { readSessionCookie, validateSession } from "./lib/auth.ts";

const PUBLIC_PATHS = ["/login", "/api/auth/send-link", "/api/auth/verify"];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
    path.startsWith("/_astro/") ||
    path === "/favicon.svg";

  const nonce = generateNonce();
  context.locals.nonce = nonce;

  const env = context.locals.runtime?.env;
  const sessionId = readSessionCookie(context.request.headers.get("Cookie"));
  if (env?.DB && sessionId) {
    const client = await validateSession(env.DB, sessionId).catch(() => null);
    if (client) {
      context.locals.client = {
        id: client.id,
        businessName: client.business_name,
        tier: client.tier,
        status: client.status,
      };
    }
  }

  if (!isPublic && !context.locals.client) {
    return context.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  if (path === "/login" && context.locals.client) {
    return context.redirect("/", 302);
  }

  const response = await next();

  if (path.startsWith("/_astro/") || /\.(?:js|css|svg|png|jpg|woff2?)$/i.test(path)) {
    return response;
  }

  return applySecurityHeaders(response, {
    nonce,
    integrations: { hubApi: true },
    cspOverrides: {
      "img-src": ["'self'", "data:"],
    },
  });
});
