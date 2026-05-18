/**
 * Cookie storage for consent decisions.
 *
 * Format: URL-encoded JSON in `mm_consent_v1` cookie.
 * On version mismatch, banner re-prompts (treats as if no consent recorded).
 *
 * Browser-side: document.cookie read/write.
 * SSR: pass cookie string from request headers (cookie attribute on Request).
 */

import {
  COOKIE_MAX_AGE_DEFAULT,
  CONSENT_SIGNALS,
  DEFAULT_COOKIE_NAME,
  type ConsentCookieOptions,
  type ConsentRecord,
  type ConsentSignal,
  type ConsentState,
  type ConsentValue,
} from "./types.js";

/**
 * Parse a Cookie header value into ConsentRecord (or null if absent/malformed/wrong version).
 * Use both in SSR (parse request cookie header) and client (parse document.cookie).
 */
export function readConsent(
  cookieHeader: string | null | undefined,
  options: { expectedVersion: string; name?: string } = { expectedVersion: "v1.0" },
): ConsentRecord | null {
  if (!cookieHeader) return null;
  const name = options.name ?? DEFAULT_COOKIE_NAME;
  const cookies = parseCookieHeader(cookieHeader);
  const raw = cookies[name];
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }

  if (!isValidConsentRecord(parsed)) return null;

  // Re-prompt if version mismatched (e.g. we added new sub-procesor → need fresh consent)
  if (parsed.version !== options.expectedVersion) return null;

  return parsed;
}

/**
 * Build a Set-Cookie header value to persist consent.
 * Use SSR: response.headers.append("Set-Cookie", buildConsentCookie(record))
 * Use client: document.cookie = buildConsentCookie(record)
 */
export function buildConsentCookie(
  record: ConsentRecord,
  options: ConsentCookieOptions = {},
): string {
  const name = options.name ?? DEFAULT_COOKIE_NAME;
  const maxAge = options.maxAgeSec ?? COOKIE_MAX_AGE_DEFAULT;
  const sameSite = options.sameSite ?? "Lax";
  const secure = options.secure ?? true;

  const value = encodeURIComponent(JSON.stringify(record));

  const parts: string[] = [`${name}=${value}`, "Path=/", `Max-Age=${maxAge}`, `SameSite=${sameSite}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Write consent cookie via document.cookie (browser-side only).
 * SSR-safe — returns silently if document undefined.
 */
export function writeConsentCookie(record: ConsentRecord, options: ConsentCookieOptions = {}): void {
  if (typeof document === "undefined") return;
  document.cookie = buildConsentCookie(record, options);
}

/**
 * Convenience: read current consent from document.cookie (browser-side).
 */
export function readConsentFromDocument(expectedVersion: string, name?: string): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  return readConsent(document.cookie, { expectedVersion, ...(name && { name }) });
}

/**
 * Delete consent cookie (e.g. user clicks "Reset consent" in footer).
 */
export function clearConsentCookie(options: ConsentCookieOptions = {}): void {
  if (typeof document === "undefined") return;
  const name = options.name ?? DEFAULT_COOKIE_NAME;
  document.cookie = `${name}=; Path=/; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const [k, ...rest] = pair.trim().split("=");
    if (!k) continue;
    out[k] = rest.join("=");
  }
  return out;
}

function isValidConsentRecord(obj: unknown): obj is ConsentRecord {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  if (typeof r["version"] !== "string") return false;
  if (typeof r["timestamp"] !== "string") return false;
  if (typeof r["explicit"] !== "boolean") return false;
  if (typeof r["state"] !== "object" || r["state"] === null) return false;
  const state = r["state"] as Record<string, unknown>;
  for (const sig of CONSENT_SIGNALS) {
    const v = state[sig];
    if (v !== "granted" && v !== "denied") return false;
  }
  return true;
}

/** Build a ConsentState from partial — fills missing signals with default-denied (except essential). */
export function fillState(partial: Partial<Record<ConsentSignal, ConsentValue>>): ConsentState {
  return {
    ad_storage: partial.ad_storage ?? "denied",
    analytics_storage: partial.analytics_storage ?? "denied",
    ad_user_data: partial.ad_user_data ?? "denied",
    ad_personalization: partial.ad_personalization ?? "denied",
    functionality_storage: partial.functionality_storage ?? "granted",
    security_storage: partial.security_storage ?? "granted",
  };
}
