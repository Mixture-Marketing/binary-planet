/**
 * SMSAPI.pl integration — send lead notification SMS to klient.
 *
 * Why SMS in addition to Resend email:
 *   - Klient (małe usługi lokalne — ślusarz, mechanik) odpowiada szybciej na SMS niż email.
 *   - Email czyta za 6h, SMS w 30 sekund = lead nie ucieka do konkurencji.
 *   - Email pozostaje (więcej szczegółów + PDF attachments dla faktur).
 *
 * Cost / privacy:
 *   - ~7-10 gr / SMS (SMSAPI.pl), polskie faktury VAT.
 *   - SMS body intentionally minimal — no full name/email/message body (RODO + 160 char limit).
 *     Just: "Nowy lead: {service} · {city} · oddzwoń: {phone_e164}" with truncation.
 *
 * Failure mode:
 *   - SMS is BEST-EFFORT (alongside email). If it fails, klient still gets email.
 *   - We log error + return ok=false so caller can record `forwarded_status='failed'` for the SMS leg.
 *
 * API ref: https://www.smsapi.pl/docs/sms/
 */

import type { ValidatedLead } from "./types.js";

const SMSAPI_URL = "https://api.smsapi.pl/sms.do";

export interface SmsapiDeps {
  /** OAuth token from SMSAPI.pl. Store as Worker secret. */
  token: string;
  /** Sender alpha-name (max 11 chars) or "INFO"/"Info" for default. */
  from?: string;
  fetchImpl?: typeof fetch;
}

export interface SmsLeadInput {
  /** Klient's mobile number, E.164 (e.g. "+48171234567"). */
  toPhone: string;
  /** Klient's business name (NOT included in SMS — kept for log/correlation). */
  businessName: string;
  /** Lead snapshot — we cherry-pick non-PII-heavy fields. */
  lead: ValidatedLead;
  /** Spoke-side client_lead_id — short ref so klient can find full lead in panel. */
  clientLeadId: string;
  /** Klient city (location context for SMS). */
  city?: string;
}

export interface SmsResult {
  ok: boolean;
  /** SMSAPI message id (when ok). */
  messageId?: string;
  /** Cost in PLN (when ok). SMSAPI returns "points" + "price"; we use price. */
  pricePln?: number;
  error?: string;
}

/**
 * Send "you have a new lead" SMS to klient. Best-effort, runs in parallel with Resend email.
 */
export async function sendLeadSmsToKlient(
  deps: SmsapiDeps,
  input: SmsLeadInput,
): Promise<SmsResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const from = (deps.from ?? "INFO").slice(0, 11);

  const message = renderSmsBody(input);

  const body = new URLSearchParams({
    to: input.toPhone.replace(/^\+/, ""), // SMSAPI accepts with or without +
    message,
    from,
    format: "json",
    encoding: "utf-8",
    // Disable url shortening (default off) and click-tracking — keeps SMS verbatim
    short: "0",
    // Validity 30 min — after that don't deliver (lead is stale anyway)
    expiration_date: String(Math.floor(Date.now() / 1000) + 30 * 60),
  });

  try {
    const res = await fetchImpl(SMSAPI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${deps.token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `SMSAPI ${res.status}: ${text.slice(0, 200)}` };
    }

    const json = (await res.json().catch(() => null)) as
      | { count?: number; list?: Array<{ id: string; points: number; status: string; price?: number }>; error?: number; message?: string }
      | null;

    // SMSAPI puts errors in same envelope: { error: 13, message: "..." }
    if (json?.error) {
      return { ok: false, error: `SMSAPI err ${json.error}: ${json.message ?? "unknown"}` };
    }
    const first = json?.list?.[0];
    if (!first) {
      return { ok: false, error: "SMSAPI returned no message id" };
    }
    if (first.status && first.status !== "QUEUE" && first.status !== "SENT") {
      return { ok: false, error: `SMSAPI status=${first.status} (id=${first.id})` };
    }

    return {
      ok: true,
      messageId: first.id,
      ...(typeof first.price === "number" && { pricePln: first.price }),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "smsapi fetch failed" };
  }
}

/**
 * Build SMS body. Keep under 160 chars (1 SMS) for cost. Polish text uses GSM-7 +
 * Polish supplementary → SMSAPI treats as Unicode if it contains ą/ć/ę/ł/ń/ó/ś/ź/ż.
 * We accept that (~70 chars per Unicode SMS) — content is short enough.
 *
 * Format: "Nowy lead - <service> (<city>) - oddzwon: <phone> [<ref>]"
 */
export function renderSmsBody(input: SmsLeadInput): string {
  const ref = input.clientLeadId.replace(/^lead_/, "").slice(0, 8);
  const service = (input.lead.service_interest ?? "kontakt").slice(0, 40);
  const city = input.city ? ` (${input.city})` : "";
  const phone = input.lead.phone ?? "brak tel";
  const valueLine = input.lead.estimated_value_pln
    ? ` ${input.lead.estimated_value_pln}zl`
    : "";
  const base = `Nowy lead - ${service}${city}${valueLine} - oddzwon: ${phone} [${ref}]`;
  return base.slice(0, 320); // SMSAPI splits >160 into multipart automatically; cap to ~2 SMS
}
