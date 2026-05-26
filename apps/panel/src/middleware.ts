/**
 * Astro middleware — auth gate + security headers for klient panel.
 *
 * Public paths: /login*, /api/auth/*, static assets.
 * Everything else: load `client` from cookie OR redirect to /login?next=...
 */

import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";
import { defineMiddleware } from "astro:middleware";

import { readSessionCookie, validateSession } from "./lib/auth.ts";
import { env } from "cloudflare:workers";

const PUBLIC_PATHS = ["/login", "/api/auth/send-link", "/api/auth/verify", "/api/logo"];
const ONBOARDING_PATHS = ["/onboarding", "/api/onboarding", "/api/auth/logout"];

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isPublic =
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
    path.startsWith("/_astro/") ||
    path === "/favicon.svg";

  const nonce = generateNonce();
  context.locals.nonce = nonce;

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

  // Track 13: redirect klient to /onboarding if wizard not yet completed.
  // Wizard required when status='provisioning' AND no client_provisioning_configs row exists.
  if (
    context.locals.client &&
    !ONBOARDING_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) &&
    !isPublic
  ) {
    const status = context.locals.client.status;
    if (status === "provisioning" || status === "pending") {
      if (env?.DB) {
        const cfg = await env.DB
          .prepare(`SELECT provisioning_status FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
          .bind(context.locals.client.id)
          .first<{ provisioning_status: string }>();
        if (!cfg) {
          // No config = klient hasn't done wizard yet
          return context.redirect("/onboarding", 302);
        }
      }
    }
  }
  // If wizard already done AND klient hits /onboarding, send to dashboard.
  if (path === "/onboarding" && context.locals.client) {
    if (env?.DB) {
      const cfg = await env.DB
        .prepare(`SELECT provisioning_status FROM client_provisioning_configs WHERE client_id = ? LIMIT 1`)
        .bind(context.locals.client.id)
        .first<{ provisioning_status: string }>();
      if (cfg) {
        // Already submitted — go to /onboarding/complete (waiting screen) or dashboard
        return context.redirect("/onboarding/complete", 302);
      }
    }
  }

  const response = await next();

  if (path.startsWith("/_astro/") || /\.(?:js|css|svg|png|jpg|woff2?)$/i.test(path)) {
    return response;
  }

  return applySecurityHeaders(response, {
    nonce,
    // Panel has 10+ inline `<script is:inline>` blocks (wizards, addons, settings
    // forms, ConfirmDialog). Astro 6 doesn't auto-propagate nonce to is:inline,
    // so strict nonce-only CSP blocks all interactivity. Klient `pending` post-
    // payment couldn't fill onboarding wizard (form submit blocked → GET reload
    // with all data in URL → security leak). Follow-up: migrate to nonce={nonce}
    // per script + remove this flag. Tracked in MEMORY.md / runbooks.
    allowAstroInlineScripts: true,
    integrations: { hubApi: true },
    cspOverrides: {
      "img-src": ["'self'", "data:"],
    },
  });
});
