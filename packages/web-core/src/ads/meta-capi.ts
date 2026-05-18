/**
 * Meta Conversions API (CAPI) server-side helper.
 *
 * Why server-side: iOS 14.5+ ATT + adblockers killed client-side Pixel reliability.
 * CAPI from server bypasses both. Critical for Meta Ads ROI.
 *
 * Usage: from mm-control-plane after lead receipt — POST to Meta with hashed user data
 * + event_id matching client-side Pixel fire → Meta dedupes.
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

import type { MetaCapiEvent } from "./types.js";

const META_CAPI_URL = "https://graph.facebook.com/v18.0";

export interface MetaCapiDeps {
  /** Pixel ID (numeric string). */
  pixelId: string;
  /** Long-lived access token (System User token; rotate quarterly). */
  accessToken: string;
  /** Test event code — for dev/staging. Production: undefined. */
  testEventCode?: string;
  fetchImpl?: typeof fetch;
}

export interface SendCapiResult {
  ok: boolean;
  /** Number of events received by Meta. */
  eventsReceived?: number;
  /** Meta-side trace ID for debugging. */
  fbtraceId?: string;
  error?: string;
}

/**
 * Send batch of events to Meta CAPI. Recommended: batch up to 1000 events per request.
 */
export async function sendMetaCapiEvents(
  deps: MetaCapiDeps,
  events: ReadonlyArray<MetaCapiEvent>,
): Promise<SendCapiResult> {
  if (events.length === 0) return { ok: true, eventsReceived: 0 };

  const fetchImpl = deps.fetchImpl ?? fetch;
  const url = `${META_CAPI_URL}/${deps.pixelId}/events?access_token=${encodeURIComponent(deps.accessToken)}`;

  const body: Record<string, unknown> = { data: events };
  if (deps.testEventCode) body["test_event_code"] = deps.testEventCode;

  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      events_received?: number;
      fbtrace_id?: string;
      error?: { message: string };
    };
    if (!res.ok) {
      return { ok: false, error: json.error?.message ?? `Meta CAPI ${res.status}` };
    }
    const result: SendCapiResult = { ok: true };
    if (json.events_received !== undefined) result.eventsReceived = json.events_received;
    if (json.fbtrace_id) result.fbtraceId = json.fbtrace_id;
    return result;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Meta CAPI network error" };
  }
}

/**
 * Build a CAPI Lead event from common input. Hashes email/phone per Meta spec
 * (sha256 lowercase + trimmed).
 *
 * Note: caller is responsible for sha256ing if email/phone are plain.
 * Use the already-hashed values from web-core/forms PII pipeline (email_hash, phone_hash).
 */
export interface BuildCapiLeadInput {
  /** Hashed email (sha256 lowercase trimmed). */
  emailHash?: string;
  /** Hashed phone (sha256 of E.164 format). */
  phoneHash?: string;
  /** Lead ID for client+server event correlation. Use spoke client_lead_id. */
  leadId: string;
  /** Source URL of the conversion (klient site URL). */
  sourceUrl: string;
  /** Client IP (request.headers.get("CF-Connecting-IP")). */
  clientIp?: string;
  /** Client User-Agent. */
  userAgent?: string;
  /** Optional value (PLN). */
  value?: number;
  /** Conversion timestamp. Default now. */
  occurredAt?: Date;
  /** Optional fbc/fbp from cookies. */
  fbc?: string;
  fbp?: string;
}

export function buildCapiLeadEvent(input: BuildCapiLeadInput): MetaCapiEvent {
  const event_time = Math.floor((input.occurredAt ?? new Date()).getTime() / 1000);
  const user_data: MetaCapiEvent["user_data"] = {};
  if (input.emailHash) user_data.em = [input.emailHash];
  if (input.phoneHash) user_data.ph = [input.phoneHash];
  if (input.clientIp) user_data.client_ip_address = input.clientIp;
  if (input.userAgent) user_data.client_user_agent = input.userAgent;
  if (input.fbc) user_data.fbc = input.fbc;
  if (input.fbp) user_data.fbp = input.fbp;

  const custom_data: Record<string, string | number> = {};
  if (input.value !== undefined) {
    custom_data["value"] = input.value;
    custom_data["currency"] = "PLN";
  }

  const event: MetaCapiEvent = {
    event_name: "Lead",
    event_time,
    event_id: input.leadId,
    user_data,
    action_source: "website",
    event_source_url: input.sourceUrl,
  };
  if (Object.keys(custom_data).length > 0) event.custom_data = custom_data;

  return event;
}
