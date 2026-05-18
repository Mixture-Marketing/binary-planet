/**
 * @mixturemarketing/web-core/security
 *
 * Security headers + CSP builder. Target: securityheaders.com grade A+.
 *
 * Quick start:
 *   import { applySecurityHeaders, generateNonce } from "@mixturemarketing/web-core/security";
 *
 *   const nonce = generateNonce();
 *   const response = await renderAstro(request, { nonce });  // pass to template
 *   return applySecurityHeaders(response, {
 *     nonce,
 *     integrations: { turnstile: true, plausible: true, hubApi: true },
 *   });
 *
 * Reference: plan/00-main.md (Faza 1 #5), plan/A-rodo.md.
 */

export const MODULE_NAME = "security" as const;

// Nonce
export { generateNonce, quoteNonce } from "./nonce.js";

// SRI
export { generateSriHash, generateSriHashForUrl, verifySriHash } from "./sri.js";
export type { GenerateSriInput, SriAlgorithm } from "./sri.js";

// Permissions-Policy
export {
  buildPermissionsPolicy,
  DEFAULT_DENY_ALL,
  KNOWN_FEATURES,
} from "./permissions-policy.js";
export type {
  FeatureAllow,
  PermissionsFeature,
  PermissionsPolicyInput,
} from "./permissions-policy.js";

// CSP
export {
  defaultCspDirectives,
  mergeCsp,
  renderCsp,
  // integrations
  clarityCsp,
  ga4Csp,
  googleAdsCsp,
  googleMapsCsp,
  hubApiCsp,
  metaPixelCsp,
  plausibleCsp,
  tiktokPixelCsp,
  turnstileCsp,
  youtubeCsp,
  zarazCsp,
} from "./csp.js";
export type { CspDirectives, CspSources } from "./csp.js";

// Top-level orchestrator
export {
  applySecurityHeaders,
  buildSecurityHeaders,
  securityMiddleware,
} from "./headers.js";
export type { SecurityHeadersOptions, SecurityMiddlewareOptions } from "./headers.js";
