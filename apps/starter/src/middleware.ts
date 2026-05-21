/**
 * Astro middleware — sets per-request CSP nonce + applies security headers.
 *
 * Order: generate nonce → store on Astro.locals → render → wrap response with headers.
 * Components inject the nonce on inline scripts via `Astro.locals.nonce`.
 */

import {
  applySecurityHeaders,
  generateNonce,
} from "@mixturemarketing/web-core/security";
import type { MiddlewareHandler } from "astro";

import clientConfig from "./client.config.ts";

export const onRequest: MiddlewareHandler = async (context, next) => {
  // Per-request nonce — used by inline <script nonce={...}> tags
  const nonce = generateNonce();
  context.locals.nonce = nonce;

  const response = await next();

  // Skip security headers for assets (preserve adapter's Content-Type, no need for CSP on .js/.css)
  const path = new URL(context.request.url).pathname;
  if (path.startsWith("/_astro/") || path.startsWith("/_image/") || /\.(?:js|css|png|jpg|svg|webp|ico|woff2?)$/i.test(path)) {
    return response;
  }

  return applySecurityHeaders(response, {
    nonce,
    // Astro 6 emituje niektóre `<script>` z `.astro` (theme toggle, mobile drawer)
    // jako inline `<script type="module">` BEZ nonce. Astro 6 `security.csp` próbowane —
    // meta tag NIE jest emitowany dla SSR routes. `allowAstroInlineScripts: true`
    // (= 'unsafe-inline' bez nonce w script-src) pozostaje jako rozwiązanie pragmatyczne.
    // Native View Transitions (CSS @view-transition) zastępują ClientRouter.
    allowAstroInlineScripts: true,
    integrations: {
      turnstile: Boolean(clientConfig.integrations.turnstileSiteKey),
      plausible: Boolean(clientConfig.integrations.plausible),
      zaraz: clientConfig.integrations.zaraz,
      ga4: Boolean(clientConfig.integrations.ga4),
      googleAds: Boolean(clientConfig.integrations.googleAdsConversionId),
      metaPixel: Boolean(clientConfig.integrations.metaPixel),
      tiktokPixel: Boolean(clientConfig.integrations.tiktokPixel),
      clarity: Boolean(clientConfig.integrations.clarity),
      hubApi: true, // form handler talks to hub
    },
  });
};
