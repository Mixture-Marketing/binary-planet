/**
 * High-level security headers orchestrator.
 *
 * Renders all headers needed for securityheaders.com grade A+:
 *  - Content-Security-Policy (strict + nonce)
 *  - Strict-Transport-Security (HSTS preload)
 *  - X-Content-Type-Options: nosniff
 *  - X-Frame-Options: DENY (legacy belt-and-suspenders with CSP frame-ancestors)
 *  - Referrer-Policy: strict-origin-when-cross-origin
 *  - Permissions-Policy: deny-everything-by-default
 *  - Cross-Origin-Opener-Policy: same-origin
 *  - Cross-Origin-Resource-Policy: same-site
 *  - X-Permitted-Cross-Domain-Policies: none
 *
 * NOT included (opt-in only):
 *  - Cross-Origin-Embedder-Policy (kills 3rd-party embeds — opt-in for SharedArrayBuffer)
 *  - Expect-CT (deprecated as of June 2021, browsers ignore)
 *  - Feature-Policy (deprecated → use Permissions-Policy)
 */

import {
  type CspDirectives,
  defaultCspDirectives,
  ga4Csp,
  googleAdsCsp,
  googleMapsCsp,
  hubApiCsp,
  metaPixelCsp,
  mergeCsp,
  plausibleCsp,
  renderCsp,
  tiktokPixelCsp,
  turnstileCsp,
  zarazCsp,
  clarityCsp,
  youtubeCsp,
} from "./csp.js";
import {
  buildPermissionsPolicy,
  DEFAULT_DENY_ALL,
  type PermissionsPolicyInput,
} from "./permissions-policy.js";

export interface SecurityHeadersOptions {
  /** Per-request nonce. Generate via {@link generateNonce}. Required for strict CSP. */
  nonce?: string;

  /** Integrations to allow in CSP. */
  integrations?: {
    turnstile?: boolean;
    zaraz?: boolean;
    plausible?: boolean | { origin?: string };
    ga4?: boolean;
    googleAds?: boolean;
    metaPixel?: boolean;
    tiktokPixel?: boolean;
    clarity?: boolean;
    googleMaps?: boolean;
    youtube?: boolean;
    /** Hub API origin (default 'https://api.mixturemarketing.pl'). */
    hubApi?: boolean | { baseUrl?: string };
  };

  /** Additional CSP directives merged on top of defaults + integrations. */
  cspOverrides?: CspDirectives;

  /** Override Permissions-Policy (default: DEFAULT_DENY_ALL). */
  permissionsPolicy?: PermissionsPolicyInput;

  /** HSTS settings. Default: 2y + includeSubDomains + preload. */
  hsts?: {
    maxAgeSeconds?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
    /** Set to true to disable HSTS entirely (NOT recommended). */
    disabled?: boolean;
  };

  /** Override Referrer-Policy. Default 'strict-origin-when-cross-origin'. */
  referrerPolicy?: string;

  /** Override Cross-Origin-Opener-Policy. Default 'same-origin'. */
  coop?: "same-origin" | "same-origin-allow-popups" | "unsafe-none";

  /** Override Cross-Origin-Resource-Policy. Default 'same-site'. */
  corp?: "same-origin" | "same-site" | "cross-origin";

  /** Enable Cross-Origin-Embedder-Policy (default off — breaks 3rd-party embeds). */
  coep?: "require-corp" | "credentialless" | false;

  /** Send CSP in report-only mode (testing). Default false (enforce). */
  cspReportOnly?: boolean;

  /**
   * Allow `'unsafe-inline'` in script-src to support Astro 6's inlined module scripts
   * (theme-toggle, mobile drawer). Recommended for public-facing starter where
   * removing ClientRouter View Transitions for hash-based CSP is too disruptive.
   * Auth-gated apps (panel/admin) should leave this OFF.
   */
  allowAstroInlineScripts?: boolean;
}

const TWO_YEARS_SECONDS = 63_072_000;

/**
 * Compute headers object suitable for `Object.entries` → response.headers.set loop.
 * Does NOT mutate any Response — see {@link applySecurityHeaders} for that.
 */
export function buildSecurityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {};

  // CSP
  const csp = renderCsp(buildCspFromOptions(options));
  if (options.cspReportOnly) {
    headers["Content-Security-Policy-Report-Only"] = csp;
  } else {
    headers["Content-Security-Policy"] = csp;
  }

  // HSTS
  if (!options.hsts?.disabled) {
    const maxAge = options.hsts?.maxAgeSeconds ?? TWO_YEARS_SECONDS;
    const includeSub = options.hsts?.includeSubDomains ?? true;
    const preload = options.hsts?.preload ?? true;
    const parts = [`max-age=${maxAge}`];
    if (includeSub) parts.push("includeSubDomains");
    if (preload) parts.push("preload");
    headers["Strict-Transport-Security"] = parts.join("; ");
  }

  // Static / always-on
  headers["X-Content-Type-Options"] = "nosniff";
  headers["X-Frame-Options"] = "DENY";
  headers["Referrer-Policy"] = options.referrerPolicy ?? "strict-origin-when-cross-origin";
  headers["X-Permitted-Cross-Domain-Policies"] = "none";

  // CORS / Isolation
  headers["Cross-Origin-Opener-Policy"] = options.coop ?? "same-origin";
  headers["Cross-Origin-Resource-Policy"] = options.corp ?? "same-site";
  if (options.coep) {
    headers["Cross-Origin-Embedder-Policy"] = options.coep;
  }

  // Permissions-Policy
  headers["Permissions-Policy"] = buildPermissionsPolicy(
    options.permissionsPolicy ?? DEFAULT_DENY_ALL,
  );

  return headers;
}

/**
 * Apply security headers to an existing Response (returns a NEW Response — Response.headers is immutable).
 *
 * Usage in Worker fetch handler:
 *
 *   const response = await getResponse(request);
 *   return applySecurityHeaders(response, { nonce: ctx.nonce, integrations: { turnstile: true } });
 *
 * Note: caller is responsible for generating + propagating `nonce` to inline scripts.
 * See `src/security/README.md` for end-to-end pattern.
 */
export function applySecurityHeaders(response: Response, options: SecurityHeadersOptions = {}): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(buildSecurityHeaders(options))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Hono-compatible middleware. Mounts before downstream handlers; sets headers on the way out.
 *
 * Usage:
 *   app.use("*", securityMiddleware({ integrations: { turnstile: true, plausible: true } }));
 *
 * NOTE: stores nonce on `c.set('nonce', ...)` so downstream handlers can inject into inline scripts.
 */
export interface SecurityMiddlewareOptions extends SecurityHeadersOptions {
  /** Generate per-request nonce. Default true. */
  perRequestNonce?: boolean;
  /** Function to generate nonce. Default uses {@link generateNonce}. */
  nonceFactory?: () => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function securityMiddleware(options: SecurityMiddlewareOptions = {}): any {
  const perRequest = options.perRequestNonce ?? true;
  const factory = options.nonceFactory ?? (() => generateNonceLocal());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async function middleware(c: any, next: () => Promise<void>): Promise<void> {
    let nonce: string | undefined;
    if (perRequest) {
      nonce = factory();
      if (typeof c.set === "function") c.set("nonce", nonce);
    }
    await next();
    const headersOpts: SecurityHeadersOptions = {
      ...options,
      ...(nonce !== undefined && { nonce }),
    };
    const headers = buildSecurityHeaders(headersOpts);
    if (c.res?.headers && typeof c.res.headers.set === "function") {
      for (const [name, value] of Object.entries(headers)) {
        c.res.headers.set(name, value);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function buildCspFromOptions(options: SecurityHeadersOptions): CspDirectives {
  const baseOpts: { nonce?: string; allowAstroInlineScripts?: boolean } = {};
  if (options.nonce !== undefined) baseOpts.nonce = options.nonce;
  if (options.allowAstroInlineScripts) baseOpts.allowAstroInlineScripts = true;
  let csp = defaultCspDirectives(baseOpts);

  const i = options.integrations ?? {};
  const additions: CspDirectives[] = [];
  if (i.turnstile) additions.push(turnstileCsp());
  if (i.zaraz) additions.push(zarazCsp());
  if (i.plausible) {
    if (typeof i.plausible === "object" && i.plausible.origin) {
      additions.push(plausibleCsp(i.plausible.origin));
    } else {
      additions.push(plausibleCsp());
    }
  }
  if (i.ga4) additions.push(ga4Csp());
  if (i.googleAds) additions.push(googleAdsCsp());
  if (i.metaPixel) additions.push(metaPixelCsp());
  if (i.tiktokPixel) additions.push(tiktokPixelCsp());
  if (i.clarity) additions.push(clarityCsp());
  if (i.googleMaps) additions.push(googleMapsCsp());
  if (i.youtube) additions.push(youtubeCsp());
  if (i.hubApi) {
    const baseUrl =
      typeof i.hubApi === "object" && i.hubApi.baseUrl
        ? i.hubApi.baseUrl
        : "https://api.mixturemarketing.pl";
    additions.push(hubApiCsp(baseUrl));
  }

  if (additions.length > 0) {
    csp = mergeCsp(csp, ...additions);
  }
  if (options.cspOverrides) {
    csp = mergeCsp(csp, options.cspOverrides);
  }
  return csp;
}

/** Local copy to avoid circular import in middleware (security/index.ts re-exports). */
function generateNonceLocal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
