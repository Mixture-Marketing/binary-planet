/**
 * @mixturemarketing/web-core/ads
 *
 * Conversion event helpers + GCLID handling + server-side Conversions API integration.
 *
 * Reference: plan/I-analytics.md (I.3 Reklamy ready).
 *
 * Two-side architecture:
 *
 * **Client-side** (mm-starter):
 *   - GCLID capture from URL → cookie
 *   - High-level helpers: fireLeadConversion(), firePhoneClick(), etc.
 *   - Each dispatches via Zaraz → fans out to all configured ad platforms
 *   - Returns event_id for client+server dedup
 *
 * **Server-side** (mm-control-plane):
 *   - Meta Conversions API: sendMetaCapiEvents() — bypass iOS ATT + adblockers
 *   - Google Ads OCT (offline conversions): buildOfflineConversionsCsv() — for closed deals
 *
 * Pairs with @mixturemarketing/web-core/zaraz (tag dispatch) +
 * @mixturemarketing/web-core/consent (consent gates).
 *
 * Quick start (client form submit):
 *
 *   import { fireLeadConversion } from "@mixturemarketing/web-core/ads";
 *
 *   form.addEventListener("submit", async (e) => {
 *     const eventId = fireLeadConversion({
 *       form_id: "contact",
 *       service_interest: "otwieranie-zamkow",
 *       value: 250,
 *     });
 *     await fetch("/api/contact", {
 *       method: "POST",
 *       body: JSON.stringify({ ...formData, meta_event_id: eventId }),
 *     });
 *   });
 *
 * Server (mm-control-plane after lead receipt):
 *
 *   import { sendMetaCapiEvents, buildCapiLeadEvent } from "@mixturemarketing/web-core/ads";
 *
 *   const event = buildCapiLeadEvent({
 *     emailHash: lead.email_hash,
 *     phoneHash: lead.phone_hash,
 *     leadId: lead.meta_event_id,  // matches client event_id → Meta dedups
 *     sourceUrl: lead.source_page,
 *     clientIp: ..., userAgent: ...,
 *   });
 *   await sendMetaCapiEvents({pixelId, accessToken}, [event]);
 */

export const MODULE_NAME = "ads" as const;

// Types
export {
  AUDIENCE_EVENTS,
  CONVERSION_EVENTS,
  PLATFORM_EVENT_MAP,
} from "./types.js";
export type {
  AudienceEventName,
  ConversionEventName,
  ConversionParams,
  GclidOptions,
  MetaCapiEvent,
} from "./types.js";

// GCLID / click ID handling
export {
  captureAllClickIds,
  captureGclid,
  parseClickIds,
  readAllStoredClickIds,
  readStoredGclid,
} from "./gclid.js";
export type { CapturedClickIds } from "./gclid.js";

// Conversion helpers
export {
  fireContactClick,
  fireFormViewer,
  fireGbpDirectionClick,
  fireGbpReviewClick,
  fireLeadConversion,
  firePhoneClick,
  fireQuoteCompleted,
  fireQuoteStarted,
  fireVisitor,
  generateEventId,
} from "./conversions.js";

// Meta CAPI (server-side)
export { buildCapiLeadEvent, sendMetaCapiEvents } from "./meta-capi.js";
export type { BuildCapiLeadInput, MetaCapiDeps, SendCapiResult } from "./meta-capi.js";

// Google Ads OCT (server-side / batch CSV)
export { buildOfflineConversionsCsv } from "./google-ads-oct.js";
export type { OfflineConversionRow } from "./google-ads-oct.js";
