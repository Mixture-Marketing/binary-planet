/**
 * OVH API signed request helper.
 *
 * OVH API auth uses 3 long-lived tokens:
 *   - OVH_APP_KEY      (application key, public-ish)
 *   - OVH_APP_SECRET   (application secret — HMAC key)
 *   - OVH_CONSUMER_KEY (per-user/per-account session key)
 *
 * Each request signed with:
 *   X-Ovh-Application: $AK
 *   X-Ovh-Consumer:    $CK
 *   X-Ovh-Timestamp:   <unix seconds, server-synced>
 *   X-Ovh-Signature:   $1$ + sha1_hex(AS + "+" + CK + "+" + METHOD + "+" + URL + "+" + BODY + "+" + TIMESTAMP)
 *
 * Default endpoint: ovh-eu (https://eu.api.ovh.com/1.0). Other regions:
 *   ovh-us → https://api.us.ovhcloud.com/1.0
 *   ovh-ca → https://ca.api.ovh.com/1.0
 *
 * Time delta: OVH requires timestamp within ~60s of their server. We fetch
 *   GET /auth/time once on cold start and cache the delta.
 */

export const OVH_ENDPOINTS: Record<string, string> = {
  "ovh-eu": "https://eu.api.ovh.com/1.0",
  "ovh-us": "https://api.us.ovhcloud.com/1.0",
  "ovh-ca": "https://ca.api.ovh.com/1.0",
};

export interface OvhClientConfig {
  appKey: string;
  appSecret: string;
  consumerKey: string;
  /** ovh-eu (default) | ovh-us | ovh-ca */
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export interface OvhRequestError extends Error {
  status: number;
  body: string;
  ovhErrorCode?: string;
}

/** Cache of server-time delta per endpoint (Date.now() - server_now*1000). */
const TIME_DELTA_CACHE = new Map<string, number>();

async function getServerTime(baseUrl: string, fetchImpl: typeof fetch): Promise<number> {
  const cached = TIME_DELTA_CACHE.get(baseUrl);
  if (cached !== undefined) {
    return Math.floor((Date.now() - cached) / 1000);
  }
  const res = await fetchImpl(`${baseUrl}/auth/time`);
  if (!res.ok) throw makeError(res.status, await res.text());
  const serverSec = Number(await res.text());
  const delta = Date.now() - serverSec * 1000;
  TIME_DELTA_CACHE.set(baseUrl, delta);
  return serverSec;
}

function makeError(status: number, body: string, message?: string): OvhRequestError {
  const err = new Error(message ?? `OVH ${status}: ${body.slice(0, 200)}`) as OvhRequestError;
  err.status = status;
  err.body = body;
  try {
    const parsed = JSON.parse(body) as { errorCode?: string };
    if (parsed.errorCode) err.ovhErrorCode = parsed.errorCode;
  } catch {
    /* not JSON */
  }
  return err;
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/**
 * Build the X-Ovh-Signature header value per spec:
 *   $1$ + sha1_hex(AS + "+" + CK + "+" + METHOD + "+" + URL + "+" + BODY + "+" + TIMESTAMP)
 */
export async function buildOvhSignature(input: {
  appSecret: string;
  consumerKey: string;
  method: string;
  url: string;
  body: string;
  timestamp: number;
}): Promise<string> {
  const raw = [
    input.appSecret,
    input.consumerKey,
    input.method,
    input.url,
    input.body,
    String(input.timestamp),
  ].join("+");
  return `$1$${await sha1Hex(raw)}`;
}

export interface OvhRequestInit {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Make a signed request to OVH API. Throws OvhRequestError on non-2xx.
 * Returns parsed JSON body (or null when 204 / empty).
 */
export async function ovhRequest<T = unknown>(
  cfg: OvhClientConfig,
  path: string,
  init: OvhRequestInit = {},
): Promise<T> {
  const fetchImpl = cfg.fetchImpl ?? fetch;
  const baseUrl = OVH_ENDPOINTS[cfg.endpoint ?? "ovh-eu"] ?? OVH_ENDPOINTS["ovh-eu"]!;
  const url = `${baseUrl}${path}`;
  const method = init.method ?? "GET";
  const bodyStr = init.body === undefined ? "" : JSON.stringify(init.body);

  const timestamp = await getServerTime(baseUrl, fetchImpl);
  const signature = await buildOvhSignature({
    appSecret: cfg.appSecret,
    consumerKey: cfg.consumerKey,
    method,
    url,
    body: bodyStr,
    timestamp,
  });

  const headers: Record<string, string> = {
    "X-Ovh-Application": cfg.appKey,
    "X-Ovh-Consumer": cfg.consumerKey,
    "X-Ovh-Timestamp": String(timestamp),
    "X-Ovh-Signature": signature,
  };
  if (bodyStr) headers["Content-Type"] = "application/json";

  const res = await fetchImpl(url, { method, headers, ...(bodyStr && { body: bodyStr }) });
  const text = await res.text();
  if (!res.ok) throw makeError(res.status, text);
  if (!text) return null as unknown as T;
  return JSON.parse(text) as T;
}
