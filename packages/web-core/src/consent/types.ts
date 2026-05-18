/**
 * Google Consent Mode v2 + RODO/GDPR cookie consent types.
 *
 * Reference:
 *   - Google Consent Mode v2: https://developers.google.com/tag-platform/security/concepts/consent
 *   - plan/I-analytics.md (I.2 Consent Mode v2)
 *   - plan/A-rodo.md (A.2 banner obowiązkowy)
 *
 * Strategy from plan:
 *   - Default analytics = Plausible (cookieless, no consent needed — always loads)
 *   - All other trackers (GA4, GAds, Meta Pixel, Clarity, TikTok) — gated on consent
 *   - 4 Consent Mode v2 signals + 2 always-granted baseline
 *   - Default state: ALL denied (RODO requires opt-in)
 *   - User toggles via banner → state propagates to Zaraz / gtag / Meta Pixel
 *   - Audit log every change in D1 consent_log (Art. 7 RODO)
 */

/**
 * Google Consent Mode v2 signals.
 * 4 granular + 2 baseline (always granted, essential cookies).
 */
export const CONSENT_SIGNALS = [
  "ad_storage",
  "analytics_storage",
  "ad_user_data",
  "ad_personalization",
  "functionality_storage",
  "security_storage",
] as const;

export type ConsentSignal = (typeof CONSENT_SIGNALS)[number];

export type ConsentValue = "granted" | "denied";

/**
 * Per-signal consent state. functionality_storage + security_storage default to granted
 * (essential cookies — site functionality requires them, exempt from RODO opt-in).
 */
export type ConsentState = Record<ConsentSignal, ConsentValue>;

/**
 * High-level user-facing categories. These map to signal groups for the UI.
 * Banner shows these 3 (or 4 with optional clarity), NOT raw signals.
 */
export const CONSENT_CATEGORIES = [
  "necessary", // always granted — functionality + security
  "analytics", // GA4, CF Web Analytics, Clarity (if used)
  "marketing", // GAds, Meta Pixel, TikTok (gated)
  "personalization", // ad_personalization (separate to allow finer granularity)
] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

/**
 * Map category → signals. Used by toggleCategory() to update multiple signals at once.
 */
export const CATEGORY_TO_SIGNALS: Readonly<Record<ConsentCategory, readonly ConsentSignal[]>> = {
  necessary: ["functionality_storage", "security_storage"],
  analytics: ["analytics_storage"],
  marketing: ["ad_storage", "ad_user_data"],
  personalization: ["ad_personalization"],
};

/**
 * Banner state stored in cookie.
 */
export interface ConsentRecord {
  /** Version of the consent text user agreed to. Re-prompts if mismatched. */
  version: string;
  /** ISO timestamp of decision. */
  timestamp: string;
  /** Per-signal state. */
  state: ConsentState;
  /** Was user given explicit choice (button click) vs. inherited default? */
  explicit: boolean;
}

/**
 * Default ALL-DENIED state — RODO compliant for first visit.
 * Only functionality_storage + security_storage granted (essential, exempt from opt-in).
 */
export const DEFAULT_DENIED_STATE: ConsentState = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
};

/**
 * "Accept all" state — used when user clicks "Akceptuj wszystkie".
 */
export const FULLY_GRANTED_STATE: ConsentState = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  functionality_storage: "granted",
  security_storage: "granted",
};

/**
 * Cookie storage configuration.
 */
export interface ConsentCookieOptions {
  /** Cookie name. Default "mm_consent_v1". */
  name?: string;
  /** Cookie domain. Default current host (omit Domain attr). */
  domain?: string;
  /** Max age in seconds. Default 365 days. */
  maxAgeSec?: number;
  /** SameSite. Default "Lax" (works for first-party flows). */
  sameSite?: "Strict" | "Lax" | "None";
  /** Secure flag. Default true (Cookie spec requires for SameSite=None). */
  secure?: boolean;
}

export const DEFAULT_COOKIE_NAME = "mm_consent_v1" as const;
export const COOKIE_MAX_AGE_DEFAULT = 365 * 24 * 60 * 60; // 1 year
