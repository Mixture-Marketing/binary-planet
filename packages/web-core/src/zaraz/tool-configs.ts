/**
 * Per-platform tool config generators.
 *
 * Each function takes the platform-specific input + returns a ZarazToolConfig
 * ready to send to CF Zaraz API for provisioning.
 *
 * Default consent purpose mappings follow plan/I-analytics.md I.2:
 *   - Plausible → necessary (cookieless, no consent needed)
 *   - GA4 → analytics
 *   - Google Ads → marketing
 *   - Meta Pixel → marketing
 *   - TikTok Pixel → marketing
 *   - MS Clarity → analytics (PII heatmaps — extra caution)
 *   - LinkedIn Insight → marketing
 */

import type { ZarazPurpose, ZarazToolConfig } from "./types.js";

/**
 * Plausible (cookieless analytics). Always-on, doesn't require consent.
 */
export function plausibleTool(opts: { origin?: string; domain?: string } = {}): ZarazToolConfig {
  return {
    name: "Plausible Analytics",
    type: "plausible",
    settings: {
      origin: opts.origin ?? "https://plausible.io",
      ...(opts.domain && { domain: opts.domain }),
    },
    consent: {
      required: false, // Plausible is cookieless → exempt from EU consent
      purposes: ["necessary"],
    },
    defaultFields: {},
  };
}

/**
 * Google Analytics 4. Requires analytics_storage consent.
 */
export function ga4Tool(opts: { measurementId: string; sendPageView?: boolean }): ZarazToolConfig {
  if (!opts.measurementId.startsWith("G-")) {
    throw new Error(`ga4Tool: measurementId must start with "G-", got "${opts.measurementId}"`);
  }
  return {
    name: `GA4 (${opts.measurementId})`,
    type: "googleanalytics",
    settings: {
      measurementId: opts.measurementId,
      sendPageViewEvent: opts.sendPageView ?? true,
    },
    consent: {
      required: true,
      purposes: ["analytics"],
    },
    events: [
      { eventName: "page_view", action: "page_view" },
      { eventName: "lead_form_submit", action: "generate_lead" },
      { eventName: "phone_click", action: "click" },
      { eventName: "quote_completed", action: "generate_lead" },
    ],
  };
}

/**
 * Google Ads conversion + remarketing.
 */
export function googleAdsTool(opts: {
  conversionId: string; // "AW-1234567890"
  /** Optional default conversion label for lead_form_submit. */
  leadConversionLabel?: string;
}): ZarazToolConfig {
  if (!opts.conversionId.startsWith("AW-")) {
    throw new Error(`googleAdsTool: conversionId must start with "AW-", got "${opts.conversionId}"`);
  }
  return {
    name: `Google Ads (${opts.conversionId})`,
    type: "googleads",
    settings: {
      conversionId: opts.conversionId,
      ...(opts.leadConversionLabel && { defaultConversionLabel: opts.leadConversionLabel }),
    },
    consent: {
      required: true,
      purposes: ["marketing"],
    },
    events: [
      { eventName: "lead_form_submit", action: "conversion" },
      { eventName: "quote_completed", action: "conversion" },
    ],
  };
}

/**
 * Meta (Facebook/Instagram) Pixel.
 */
export function metaPixelTool(opts: { pixelId: string }): ZarazToolConfig {
  if (!/^\d+$/.test(opts.pixelId)) {
    throw new Error(`metaPixelTool: pixelId must be numeric, got "${opts.pixelId}"`);
  }
  return {
    name: `Meta Pixel (${opts.pixelId})`,
    type: "facebookpixel",
    settings: {
      pixelId: opts.pixelId,
    },
    consent: {
      required: true,
      purposes: ["marketing"],
    },
    events: [
      { eventName: "page_view", action: "PageView" },
      { eventName: "lead_form_submit", action: "Lead" },
      { eventName: "phone_click", action: "Contact" },
      { eventName: "quote_completed", action: "Lead" },
    ],
  };
}

/**
 * TikTok Pixel.
 */
export function tiktokPixelTool(opts: { pixelId: string }): ZarazToolConfig {
  return {
    name: `TikTok Pixel (${opts.pixelId})`,
    type: "tiktokpixel",
    settings: {
      pixelId: opts.pixelId,
    },
    consent: {
      required: true,
      purposes: ["marketing"],
    },
    events: [
      { eventName: "page_view", action: "Pageview" },
      { eventName: "lead_form_submit", action: "SubmitForm" },
      { eventName: "phone_click", action: "ClickButton" },
    ],
  };
}

/**
 * MS Clarity — heatmaps + session recording. PII-heavy → requires consent.
 */
export function clarityTool(opts: { projectId: string }): ZarazToolConfig {
  return {
    name: `MS Clarity (${opts.projectId})`,
    type: "microsoftclarity",
    settings: {
      projectId: opts.projectId,
    },
    consent: {
      required: true,
      purposes: ["analytics"], // could argue marketing too — analytics is conservative
    },
  };
}

/**
 * LinkedIn Insight Tag — B2B audience tracking (mostly relevant for "professional" preset).
 */
export function linkedinInsightTool(opts: { partnerId: string }): ZarazToolConfig {
  return {
    name: `LinkedIn Insight (${opts.partnerId})`,
    type: "linkedininsight",
    settings: {
      partnerId: opts.partnerId,
    },
    consent: {
      required: true,
      purposes: ["marketing"],
    },
  };
}

/**
 * Generic custom HTML/JS snippet — escape hatch for klient-specific trackers.
 */
export function customHtmlTool(opts: {
  name: string;
  html: string;
  purposes?: ZarazPurpose[];
}): ZarazToolConfig {
  return {
    name: opts.name,
    type: "customhtml",
    settings: {
      html: opts.html,
    },
    consent: {
      required: (opts.purposes ?? ["marketing"]).length > 0 && !(opts.purposes ?? ["marketing"]).includes("necessary"),
      purposes: opts.purposes ?? ["marketing"],
    },
  };
}
