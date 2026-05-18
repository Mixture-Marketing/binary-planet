/**
 * High-level conversion helpers — browser-side, dispatch via Zaraz.
 *
 * Use in form handlers, click handlers. Each helper:
 *   - Fires standard event name via Zaraz
 *   - Includes hashed user data when available
 *   - Generates event_id for client+server dedup (Meta CAPI / GAds Enhanced Conversions)
 *   - Returns generated event_id (caller can pass to server for matching)
 */

import { trackEvent } from "../zaraz/runtime.js";
import { readAllStoredClickIds } from "./gclid.js";
import type { ConversionParams } from "./types.js";

/**
 * Generate a unique event_id for client+server dedup.
 * Format: `<eventName>_<timestamp>_<random>` — readable, unique enough for 1M events/sec.
 */
export function generateEventId(eventName: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${eventName}_${Date.now()}_${random}`;
}

/**
 * Fire lead form submission conversion. Returns event_id.
 *
 * Typical caller: ContactForm submit success.
 *
 *   const eventId = fireLeadConversion({ form_id: "contact", value: 250 });
 *   // Send eventId to /api/leads → server sends Meta CAPI Lead event with same event_id → Meta dedups
 */
export function fireLeadConversion(params: ConversionParams = {}): string {
  const eventId = generateEventId("lead");
  const clickIds = readAllStoredClickIds();
  trackEvent("lead_form_submit", {
    event_id: eventId,
    ...clickIds,
    currency: "PLN",
    ...params,
  });
  return eventId;
}

/**
 * Fire phone click conversion (micro). Returns event_id.
 */
export function firePhoneClick(params: ConversionParams = {}): string {
  const eventId = generateEventId("phone");
  trackEvent("phone_click", {
    event_id: eventId,
    ...params,
  });
  return eventId;
}

/**
 * Fire email/sms/whatsapp click conversion (micro).
 */
export function fireContactClick(
  channel: "email" | "sms" | "whatsapp",
  params: ConversionParams = {},
): string {
  const eventName = `${channel}_click` as const;
  const eventId = generateEventId(channel);
  trackEvent(eventName, { event_id: eventId, ...params });
  return eventId;
}

/**
 * Fire quote calculator started.
 */
export function fireQuoteStarted(params: ConversionParams = {}): string {
  const eventId = generateEventId("quote_start");
  trackEvent("quote_started", { event_id: eventId, ...params });
  return eventId;
}

/**
 * Fire quote calculator completed. Secondary conversion — should pass estimated_value if known.
 */
export function fireQuoteCompleted(params: ConversionParams & { value?: number } = {}): string {
  const eventId = generateEventId("quote_done");
  const clickIds = readAllStoredClickIds();
  trackEvent("quote_completed", {
    event_id: eventId,
    ...clickIds,
    currency: "PLN",
    ...params,
  });
  return eventId;
}

/**
 * Fire GBP direction click (micro — strong local intent signal).
 */
export function fireGbpDirectionClick(params: ConversionParams = {}): string {
  const eventId = generateEventId("gbp_dir");
  trackEvent("gbp_direction_click", { event_id: eventId, ...params });
  return eventId;
}

/**
 * Fire GBP review click (micro — high-funnel awareness).
 */
export function fireGbpReviewClick(params: ConversionParams = {}): string {
  const eventId = generateEventId("gbp_rev");
  trackEvent("gbp_review_click", { event_id: eventId, ...params });
  return eventId;
}

/**
 * Fire visitor event — used for remarketing pool population.
 * Typically called once per page view (debounce in caller if needed).
 */
export function fireVisitor(params: ConversionParams = {}): string {
  const eventId = generateEventId("visitor");
  trackEvent("page_view", { event_id: eventId, ...params });
  return eventId;
}

/**
 * Fire form_viewer audience event — user saw form but hasn't submitted.
 * Use IntersectionObserver on form element.
 */
export function fireFormViewer(formId: string, params: ConversionParams = {}): string {
  const eventId = generateEventId("form_view");
  trackEvent("lead_form_view", { event_id: eventId, form_id: formId, ...params });
  return eventId;
}
