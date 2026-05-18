/**
 * @mixturemarketing/web-core/consent
 *
 * RODO/GDPR cookie consent banner + Google Consent Mode v2 integration.
 *
 * Strategy (plan/I-analytics.md I.2):
 *   - Default analytics: Plausible (cookieless, no consent needed — always loads)
 *   - Trackers gated on consent: GA4, Google Ads, Meta Pixel, TikTok, MS Clarity
 *   - 4 granular signals + 2 baseline (always-granted essential)
 *   - First visit: ALL denied (RODO opt-in requirement)
 *   - Versioned consent text — re-prompt on bump
 *   - Audit log every change → D1 consent_log (Art. 7 RODO)
 *
 * Quick start (Astro):
 *
 *   In <head>:
 *     <Fragment set:html={defaultConsentScriptTag({nonce: Astro.locals.nonce})} />
 *
 *   In <body>:
 *     <style>{consentBannerCss()}{preferencesModalCss()}</style>
 *     <Fragment set:html={consentBannerHtml({businessName, privacyUrl, version: 'v1.0'})} />
 *     <Fragment set:html={preferencesModalHtml()} />
 *     <script>
 *       import { initConsentRuntime } from "@mixturemarketing/web-core/consent";
 *       initConsentRuntime({ version: "v1.0" });
 *     </script>
 */

export const MODULE_NAME = "consent" as const;

// Types
export {
  CATEGORY_TO_SIGNALS,
  COOKIE_MAX_AGE_DEFAULT,
  CONSENT_CATEGORIES,
  CONSENT_SIGNALS,
  DEFAULT_COOKIE_NAME,
  DEFAULT_DENIED_STATE,
  FULLY_GRANTED_STATE,
} from "./types.js";
export type {
  ConsentCategory,
  ConsentCookieOptions,
  ConsentRecord,
  ConsentSignal,
  ConsentState,
  ConsentValue,
} from "./types.js";

// Storage
export {
  buildConsentCookie,
  clearConsentCookie,
  fillState,
  readConsent,
  readConsentFromDocument,
  writeConsentCookie,
} from "./storage.js";

// Default state script (SSR)
export {
  applyConsentUpdate,
  defaultConsentScript,
  defaultConsentScriptTag,
} from "./default-state.js";
export type { DefaultStateOptions } from "./default-state.js";

// Banner UI (SSR)
export { consentBannerCss, consentBannerHtml } from "./banner.js";
export type { ConsentBannerOptions } from "./banner.js";

// Preferences modal UI (SSR)
export { preferencesModalCss, preferencesModalHtml } from "./preferences.js";
export type { PreferencesModalOptions } from "./preferences.js";

// Runtime (browser)
export { initConsentRuntime } from "./runtime.js";
export type { ConsentRuntimeOptions } from "./runtime.js";
