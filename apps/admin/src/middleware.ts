/**
 * Astro middleware — auth check + security headers.
 *
 * Routes that require auth: everything under "/" EXCEPT /login* and /api/auth/*.
 * Logged-out user hitting protected route → redirect to /login.
 * Logged-in user hitting /login → redirect to /.
 */

import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";
import { defineMiddleware } from "astro:middleware";

import { readSessionCookie, validateSession } from "./lib/auth.ts";
import { env } from "cloudflare:workers";

const PUBLIC_PATHS = ["/login", "/api/auth/send-link", "/api/auth/verify"];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
    path.startsWith("/_astro/") ||
    path === "/favicon.svg";

  // Per-request nonce for CSP
  const nonce = generateNonce();
  context.locals.nonce = nonce;

  // Try to load user from session cookie regardless (public pages need to check too)
  const sessionId = readSessionCookie(context.request.headers.get("Cookie"));
  if (env?.DB && sessionId) {
    const user = await validateSession(env.DB, sessionId).catch(() => null);
    if (user) {
      context.locals.user = {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      };
    }
  }

  // Auth gate
  if (!isPublic && !context.locals.user) {
    return context.redirect(`/login?next=${encodeURIComponent(path)}`, 302);
  }
  // Already-logged-in user hitting /login → redirect to home
  if (path === "/login" && context.locals.user) {
    return context.redirect("/", 302);
  }

  const response = await next();

  // Skip headers for assets
  if (path.startsWith("/_astro/") || /\.(?:js|css|svg|png|jpg|woff2?)$/i.test(path)) {
    return response;
  }

  return applySecurityHeaders(response, {
    nonce,
    // Admin has 6+ inline `<script is:inline>` blocks (onboarding wizard, retry
    // buttons, cron triggers, alerts handlers). Same constraint as panel —
    // Astro 6 doesn't propagate nonce to is:inline scripts so strict nonce-only
    // CSP blocks all interactivity. Follow-up: migrate to nonce={nonce} per script.
    allowAstroInlineScripts: true,
    integrations: { hubApi: true },
    // Admin panel: stricter — no analytics, no marketing trackers
    cspOverrides: {
      "img-src": ["'self'", "data:"],
    },
  });
});
