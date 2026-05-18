/**
 * Content-Security-Policy builder.
 *
 * Strategy: strict CSP with nonce + `strict-dynamic` for script-src.
 *   - Per-request nonce attached to inline <script> + script-src directive
 *   - 'strict-dynamic' lets scripts loaded by trusted scripts also execute
 *     (so we don't need to allowlist every CDN)
 *   - object-src 'none' + base-uri 'self' + frame-ancestors 'none' = anti-clickjacking
 *
 * Integrations (CF Zaraz, Turnstile, GA4, Meta Pixel, ...) extend specific directives.
 * Always build CSP via {@link buildCsp} — never hand-concatenate.
 */

import { quoteNonce } from "./nonce.js";

/**
 * Source-list directive value. Tokens get joined with single space.
 * Common tokens:
 *   - "'self'"
 *   - "'none'"
 *   - "'unsafe-inline'" (use sparingly — kills CSP value)
 *   - "'strict-dynamic'"
 *   - "https://..."
 *   - "'nonce-...'" — use {@link quoteNonce}
 *   - "'sha256-...'" / "'sha384-...'"
 */
export type CspSources = readonly string[];

export interface CspDirectives {
  "default-src"?: CspSources;
  "script-src"?: CspSources;
  "script-src-elem"?: CspSources;
  "script-src-attr"?: CspSources;
  "style-src"?: CspSources;
  "style-src-elem"?: CspSources;
  "style-src-attr"?: CspSources;
  "img-src"?: CspSources;
  "font-src"?: CspSources;
  "connect-src"?: CspSources;
  "media-src"?: CspSources;
  "object-src"?: CspSources;
  "frame-src"?: CspSources;
  "frame-ancestors"?: CspSources;
  "form-action"?: CspSources;
  "base-uri"?: CspSources;
  "manifest-src"?: CspSources;
  "worker-src"?: CspSources;
  "child-src"?: CspSources;
  "prefetch-src"?: CspSources;
  /** Sentinel directives (no source list). True → include. */
  "upgrade-insecure-requests"?: boolean;
  "block-all-mixed-content"?: boolean;
  /** Reporting (Faza 5+). */
  "report-uri"?: string;
  "report-to"?: string;
}

const SENTINEL_KEYS = new Set(["upgrade-insecure-requests", "block-all-mixed-content"]);
const STRING_KEYS = new Set(["report-uri", "report-to"]);

/**
 * Render directives into a header value string.
 *   "default-src 'self'; script-src 'self' 'nonce-...'; ..."
 */
export function renderCsp(directives: CspDirectives): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(directives)) {
    if (value === undefined) continue;
    if (SENTINEL_KEYS.has(key)) {
      if (value === true) parts.push(key);
      continue;
    }
    if (STRING_KEYS.has(key)) {
      parts.push(`${key} ${String(value)}`);
      continue;
    }
    const sources = value as CspSources;
    if (sources.length === 0) continue;
    parts.push(`${key} ${sources.join(" ")}`);
  }
  return parts.join("; ");
}

/**
 * Default strict-CSP baseline. Apps merge their domain + integrations into this.
 */
export function defaultCspDirectives(opts: { nonce?: string; allowDataImages?: boolean } = {}): CspDirectives {
  const scriptSrc: string[] = ["'self'", "'strict-dynamic'"];
  if (opts.nonce) scriptSrc.push(quoteNonce(opts.nonce));

  const imgSrc: string[] = ["'self'", "https:"];
  if (opts.allowDataImages !== false) imgSrc.push("data:"); // Sveltia previews, OG fallbacks

  return {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "script-src-attr": ["'none'"], // no inline event handlers (onclick=) ever
    // Tailwind v4 emits a few inline styles for `style=` attrs and Astro runtime; allow.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": imgSrc,
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"],
    "media-src": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "upgrade-insecure-requests": true,
  };
}

/**
 * Merge directive sources additively (sources concat + dedupe).
 * Sentinel/string directives use override semantics (last wins).
 */
export function mergeCsp(base: CspDirectives, ...overrides: CspDirectives[]): CspDirectives {
  const result: CspDirectives = { ...base };
  for (const override of overrides) {
    for (const [key, value] of Object.entries(override) as [keyof CspDirectives, unknown][]) {
      if (value === undefined) continue;
      if (SENTINEL_KEYS.has(key) || STRING_KEYS.has(key)) {
        (result as Record<string, unknown>)[key] = value;
        continue;
      }
      const existing = (result[key] as CspSources | undefined) ?? [];
      const merged = dedupe([...existing, ...(value as CspSources)]);
      (result as Record<string, CspSources>)[key] = merged;
    }
  }
  return result;
}

function dedupe(arr: readonly string[]): string[] {
  return Array.from(new Set(arr));
}

// ---------------------------------------------------------------------------
// Integration extensions — each returns directives to merge into the policy
// ---------------------------------------------------------------------------

/** Cloudflare Turnstile (anti-bot). Required when {@link verifyTurnstileToken} is used. */
export function turnstileCsp(): CspDirectives {
  return {
    "script-src": ["https://challenges.cloudflare.com"],
    "frame-src": ["https://challenges.cloudflare.com"],
  };
}

/** Cloudflare Zaraz (server-side tag manager). */
export function zarazCsp(): CspDirectives {
  return {
    "script-src": ["https://cdn.zaraz.com"],
    "connect-src": ["https://*.zaraz.cloud"],
  };
}

/** Plausible Analytics (cookieless, default analytics in our stack). */
export function plausibleCsp(scriptOrigin = "https://plausible.io"): CspDirectives {
  return {
    "script-src": [scriptOrigin],
    "connect-src": [scriptOrigin],
  };
}

/** Google Analytics 4 / Google Tag Manager. */
export function ga4Csp(): CspDirectives {
  return {
    "script-src": ["https://www.googletagmanager.com", "https://www.google-analytics.com"],
    "connect-src": [
      "https://www.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.g.doubleclick.net",
    ],
    "img-src": ["https://www.google-analytics.com", "https://*.g.doubleclick.net"],
  };
}

/** Google Ads (conversion + remarketing). */
export function googleAdsCsp(): CspDirectives {
  return {
    "script-src": ["https://www.googletagmanager.com", "https://www.googleadservices.com"],
    "connect-src": ["https://*.google.com", "https://*.googleadservices.com"],
    "img-src": ["https://*.google.com", "https://*.googleadservices.com"],
    "frame-src": ["https://*.google.com", "https://*.doubleclick.net"],
  };
}

/** Meta (Facebook/Instagram) Pixel. */
export function metaPixelCsp(): CspDirectives {
  return {
    "script-src": ["https://connect.facebook.net"],
    "connect-src": ["https://*.facebook.com", "https://*.facebook.net"],
    "img-src": ["https://*.facebook.com", "https://*.facebook.net"],
  };
}

/** Microsoft Clarity (heatmaps — wymaga consent jako PII). */
export function clarityCsp(): CspDirectives {
  return {
    "script-src": ["https://www.clarity.ms", "https://*.clarity.ms"],
    "connect-src": ["https://*.clarity.ms"],
  };
}

/** TikTok Pixel. */
export function tiktokPixelCsp(): CspDirectives {
  return {
    "script-src": ["https://analytics.tiktok.com"],
    "connect-src": ["https://*.tiktok.com", "https://analytics.tiktok.com"],
    "img-src": ["https://*.tiktok.com"],
  };
}

/** Google Maps (embed). */
export function googleMapsCsp(): CspDirectives {
  return {
    "script-src": ["https://maps.googleapis.com"],
    "frame-src": ["https://*.google.com"],
    "img-src": ["https://maps.gstatic.com", "https://*.googleapis.com"],
    "connect-src": ["https://maps.googleapis.com"],
  };
}

/** Hub API allow (spoke fetches own hub for /api/feature-flags etc.). */
export function hubApiCsp(hubBaseUrl: string): CspDirectives {
  const origin = new URL(hubBaseUrl).origin;
  return {
    "connect-src": [origin],
  };
}

/** YouTube embeds. */
export function youtubeCsp(): CspDirectives {
  return {
    "frame-src": ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
    "img-src": ["https://i.ytimg.com"],
  };
}
