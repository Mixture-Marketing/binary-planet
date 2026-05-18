/**
 * GCLID (Google Click Identifier) capture + storage.
 *
 * Workflow:
 *   1. User clicks Google Ad → lands on klient.pl/?gclid=abc123
 *   2. captureGclid() reads URL param, stores in cookie (90-day window)
 *   3. On conversion: send GCLID with conversion → Google attributes click → conversion
 *
 * Without GCLID Google can't tie conversions to ad clicks → broken attribution.
 *
 * Same pattern for:
 *   - gbraid / wbraid (iOS Privacy click IDs)
 *   - fbclid (Meta — used for fbc cookie)
 *   - msclkid (Microsoft Ads / Bing)
 *   - ttclid (TikTok)
 */

import type { GclidOptions } from "./types.js";

const DEFAULT_COOKIE_NAME = "_gcl_aw";
const DEFAULT_MAX_AGE = 90 * 24 * 60 * 60; // 90 days — Google attribution window

export interface CapturedClickIds {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  ttclid?: string;
}

/**
 * Parse all known click IDs from a URL search string.
 * SSR-safe (pass URLSearchParams from request URL).
 */
export function parseClickIds(searchParams: URLSearchParams): CapturedClickIds {
  const out: CapturedClickIds = {};
  const gclid = searchParams.get("gclid");
  const gbraid = searchParams.get("gbraid");
  const wbraid = searchParams.get("wbraid");
  const fbclid = searchParams.get("fbclid");
  const msclkid = searchParams.get("msclkid");
  const ttclid = searchParams.get("ttclid");
  if (gclid) out.gclid = gclid;
  if (gbraid) out.gbraid = gbraid;
  if (wbraid) out.wbraid = wbraid;
  if (fbclid) out.fbclid = fbclid;
  if (msclkid) out.msclkid = msclkid;
  if (ttclid) out.ttclid = ttclid;
  return out;
}

/**
 * Capture GCLID from current URL + persist to cookie.
 * Returns captured value (or undefined if none in URL).
 * SSR-safe — no-op when document undefined.
 */
export function captureGclid(options: GclidOptions = {}): string | undefined {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);
  const gclid = params.get("gclid");
  if (!gclid) return undefined;

  saveGclidCookie(gclid, options);
  return gclid;
}

/** Capture all known click IDs into separate cookies. */
export function captureAllClickIds(options: GclidOptions = {}): CapturedClickIds {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  const captured = parseClickIds(params);

  if (captured.gclid) saveCookie("_gcl_aw", captured.gclid, options);
  if (captured.gbraid) saveCookie("_gcl_gb", captured.gbraid, options);
  if (captured.wbraid) saveCookie("_gcl_wb", captured.wbraid, options);
  if (captured.fbclid) saveCookie("_fbc", `fb.1.${Date.now()}.${captured.fbclid}`, options);
  if (captured.msclkid) saveCookie("_msclkid", captured.msclkid, options);
  if (captured.ttclid) saveCookie("_ttp", captured.ttclid, options);

  return captured;
}

/**
 * Read stored GCLID from cookie (e.g. on conversion).
 */
export function readStoredGclid(options: { cookieName?: string } = {}): string | undefined {
  if (typeof document === "undefined") return undefined;
  const name = options.cookieName ?? DEFAULT_COOKIE_NAME;
  return readCookie(name) ?? undefined;
}

/**
 * Read all stored click IDs (for sending with server-side conversion).
 */
export function readAllStoredClickIds(): CapturedClickIds {
  if (typeof document === "undefined") return {};
  const result: CapturedClickIds = {};
  const map = [
    ["_gcl_aw", "gclid"],
    ["_gcl_gb", "gbraid"],
    ["_gcl_wb", "wbraid"],
    ["_msclkid", "msclkid"],
    ["_ttp", "ttclid"],
  ] as const;
  for (const [cookie, key] of map) {
    const value = readCookie(cookie);
    if (value) result[key as keyof CapturedClickIds] = value;
  }
  // Meta _fbc has different format: "fb.1.<timestamp>.<fbclid>"
  const fbc = readCookie("_fbc");
  if (fbc) {
    const fbclid = fbc.split(".").pop();
    if (fbclid) result.fbclid = fbclid;
  }
  return result;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function saveGclidCookie(gclid: string, options: GclidOptions): void {
  const name = options.cookieName ?? DEFAULT_COOKIE_NAME;
  saveCookie(name, gclid, options);
}

function saveCookie(name: string, value: string, options: GclidOptions): void {
  if (typeof document === "undefined") return;
  const maxAge = options.maxAgeSec ?? DEFAULT_MAX_AGE;
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`, "Path=/", `Max-Age=${maxAge}`, "SameSite=Lax"];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (window.location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const c of cookies) {
    const [k, ...rest] = c.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
