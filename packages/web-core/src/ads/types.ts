/**
 * Ads conversion tracking types.
 *
 * Reference: plan/I-analytics.md (I.3 Reklamy ready).
 *
 * Architecture:
 *   - High-level conversion helpers (fireLeadConversion, firePhoneClick, etc.)
 *   - Each dispatches via Zaraz (which fans out to GAds/Meta/TikTok/etc.)
 *   - Server-side helpers (Conversions API for Meta, OCT for GAds) — used by hub when forwarding leads
 */

/**
 * Standard conversion events emitted by mm-starter client sites.
 * Mapped per-platform in tool configs (see @mixturemarketing/web-core/zaraz).
 */
export const CONVERSION_EVENTS = [
  "lead_form_submit", // primary conversion — form submitted with consent
  "phone_click", // micro-conversion — tel: link clicked
  "email_click", // micro
  "sms_click", // micro
  "whatsapp_click", // micro
  "quote_started", // funnel — calculator opened
  "quote_completed", // funnel — calculator finished, secondary conversion
  "gbp_direction_click", // micro — clicked "wskazówki" in GBP integration
  "gbp_review_click", // micro
] as const;

export type ConversionEventName = (typeof CONVERSION_EVENTS)[number];

/**
 * Standard audience events. Used for remarketing exclusion (e.g. exclude lead_converters
 * from "lead generation" campaign — don't waste ad spend on already-converted users).
 */
export const AUDIENCE_EVENTS = [
  "visitor", // any page view — generic remarketing pool
  "form_viewer", // viewed form but didn't submit — strong intent
  "lead_converter", // submitted form — EXCLUDE from acquisition campaigns
] as const;

export type AudienceEventName = (typeof AUDIENCE_EVENTS)[number];

/**
 * Conversion parameters — typed for common fields, allows extras.
 */
export interface ConversionParams {
  /** Conversion value in PLN. */
  value?: number;
  currency?: string;
  /** Hashed identifier (email_hash or phone_hash from /forms). NEVER plain PII. */
  user_data_hash?: string;
  /** Klient-supplied conversion label override (mapped to AW-XXXX/conversion_label). */
  conversion_label?: string;
  /** Service slug or category. */
  service_interest?: string;
  /** Source page URL (relative). */
  source_page?: string;
  /** Allow arbitrary extras (event-specific params). */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Per-platform conversion mapping. Maps our standard event names to platform-specific.
 * Used both client-side (Zaraz dispatch) and server-side (Conversions API helpers).
 */
export const PLATFORM_EVENT_MAP = {
  google_ads: {
    lead_form_submit: { type: "conversion", default_label: undefined as string | undefined },
    phone_click: { type: "click", default_label: undefined },
    quote_completed: { type: "conversion", default_label: undefined },
  },
  meta_pixel: {
    lead_form_submit: "Lead",
    phone_click: "Contact",
    email_click: "Contact",
    whatsapp_click: "Contact",
    quote_started: "InitiateCheckout",
    quote_completed: "Lead",
  },
  tiktok_pixel: {
    lead_form_submit: "SubmitForm",
    phone_click: "ClickButton",
    quote_completed: "SubmitForm",
  },
} as const;

/**
 * GCLID storage options.
 * GCLID = Google Click Identifier; captured from URL on first visit, stored in cookie,
 * sent back with conversion → attribution.
 */
export interface GclidOptions {
  /** Cookie name. Default "_gcl_aw". */
  cookieName?: string;
  /** Max age in seconds. Default 90 days (Google attribution window). */
  maxAgeSec?: number;
  /** Domain (for shared subdomain attribution). */
  domain?: string;
}

/**
 * Meta Pixel Conversions API event (server-side dispatch).
 */
export interface MetaCapiEvent {
  event_name: string;
  event_time: number; // unix seconds
  /** Unique event ID — used for client+server dedup. */
  event_id: string;
  /** Hashed user data (sha256 email / phone). */
  user_data: {
    em?: string[]; // hashed email
    ph?: string[]; // hashed phone
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string; // _fbc cookie
    fbp?: string; // _fbp cookie
  };
  custom_data?: Record<string, string | number>;
  action_source: "website" | "email" | "phone_call" | "system_generated" | "other";
  event_source_url?: string;
}
