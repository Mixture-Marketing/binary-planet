/**
 * Cloudflare Zaraz types.
 *
 * Reference: plan/I-analytics.md (I.1 Zaraz server-side tagging).
 *
 * What is Zaraz? CF's server-side tag manager. Browser sends 1 request to Zaraz,
 * Zaraz fans out to GA4 / GAds / Meta Pixel / etc. server-side. Benefits:
 *   - CWV boost: -200-400ms LCP vs client-side GTM
 *   - 30-40% traffic recovery vs adblockers (first-party origin)
 *   - Native Consent Mode v2 support
 *   - Free tier: 1M events/mc per Worker
 *
 * This module:
 *   - Generates tool configs (CF API payloads) for provisioning per klient
 *   - Runtime `trackEvent()` wrapper that hits window.zaraz.track + fallbacks
 *   - Maps our 4 consent categories to Zaraz purposes
 */

/**
 * Supported tool types (Zaraz Tool Library subset for service businesses).
 */
export type ZarazToolType =
  | "googleanalytics" // GA4
  | "googleads" // Google Ads conversion + remarketing
  | "facebookpixel" // Meta Pixel
  | "tiktokpixel" // TikTok Pixel
  | "linkedininsight" // LinkedIn Insight Tag (B2B clients)
  | "microsoftclarity" // MS Clarity (heatmaps — requires consent)
  | "plausible" // Plausible (cookieless — no consent)
  | "customhtml"; // Custom HTML/JS snippet (escape hatch)

/**
 * Zaraz purposes — high-level categories shown in CF Dashboard consent UI.
 * Maps to our 4 user-facing categories in @mixturemarketing/web-core/consent.
 */
export type ZarazPurpose = "necessary" | "analytics" | "marketing" | "personalization";

/**
 * Single tool configuration (CF Zaraz API payload subset).
 * Real CF API has more fields (neoEvents, transforms, etc.) — we expose minimum useful.
 */
export interface ZarazToolConfig {
  /** Display name in CF dashboard. */
  name: string;
  /** Tool kind. */
  type: ZarazToolType;
  /** Tool-specific settings (measurementId for GA4, pixelId for Meta, etc.). */
  settings: Record<string, string | boolean | number>;
  /** Default events to track for this tool. */
  defaultFields?: Record<string, string>;
  /** Consent requirements. */
  consent: {
    /** True if user must opt-in before tool activates. */
    required: boolean;
    /** Purposes this tool serves. Tool blocked until ALL purposes granted. */
    purposes: ZarazPurpose[];
  };
  /** Optional event mappings — Zaraz event name → tool-specific behavior. */
  events?: ReadonlyArray<{
    eventName: string;
    action: string; // tool-specific (e.g. "Purchase" for Meta, "conversion" for GAds)
    parameters?: Record<string, string>;
  }>;
}

/**
 * Klient-specific integration flags — typically read from client.config.ts.integrations.
 * Each flag enables corresponding tool config generation.
 */
export interface IntegrationFlags {
  plausible?: boolean | { origin?: string };
  ga4?: string; // measurement ID, e.g. "G-XXXXXXX"
  googleAds?: { conversionId: string; conversionLabel?: string };
  metaPixel?: string; // pixel ID
  tiktokPixel?: string;
  clarity?: string; // project ID
  linkedinInsight?: string; // partner ID
  customHtml?: ReadonlyArray<{ name: string; html: string; purposes?: ZarazPurpose[] }>;
}

/**
 * Output: array of tool configs ready to provision via CF API per klient.
 */
export interface BuildToolsOutput {
  tools: ZarazToolConfig[];
  /** Soft warnings about misconfigured tools. */
  warnings: string[];
}

/**
 * Standard event names emitted by mm-starter client sites.
 * Centralized here so dashboards, conversion mappings, and analytics queries stay in sync.
 */
export const STANDARD_EVENTS = [
  // Lead funnel
  "page_view",
  "lead_form_view",
  "lead_form_submit",
  "quote_started",
  "quote_completed",

  // Contact actions
  "phone_click",
  "sms_click",
  "email_click",
  "whatsapp_click",

  // GBP / local
  "gbp_direction_click",
  "gbp_review_click",

  // Engagement
  "scroll_depth_75",
  "engagement_time_30s",

  // Consent
  "cookie_consent_change",
] as const;

export type StandardEvent = (typeof STANDARD_EVENTS)[number];

/**
 * Parameters typed by event. Optional — caller can pass arbitrary object too.
 */
export interface EventParameters {
  // Common
  page_path?: string;
  page_title?: string;
  page_referrer?: string;

  // Lead form
  form_id?: string;
  form_position?: string;
  service_interest?: string;
  lead_id?: string;
  estimated_value?: number;

  // Click events
  phone_number_hash?: string;
  email_hash?: string;
  position?: string;

  // Consent
  new_state?: string;

  // Allow arbitrary extras
  [key: string]: string | number | boolean | undefined;
}
