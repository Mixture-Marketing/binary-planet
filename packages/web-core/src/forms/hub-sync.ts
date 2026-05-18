/**
 * POST lead to hub (mm-control-plane) with timeout + retry.
 *
 * Spoke → hub auth: X-BP-Client-Key header (BP_CLIENT_API_KEY).
 * Hub verifies sha256(key) against D1 clients.api_key_hash (current or *_new during rotation).
 */

import type { TransportLead } from "./types.js";

export interface HubSyncDeps {
  hubBaseUrl: string; // e.g. 'https://api.mixturemarketing.pl'
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface HubSyncOptions {
  timeoutMs?: number; // default 3000
  maxRetries?: number; // default 1 (1 retry = 2 total attempts)
  /** Backoff base ms — actual delay = base * 2^attempt + jitter. */
  backoffBaseMs?: number;
}

export interface HubSyncResult {
  ok: boolean;
  /** Hub-assigned lead ID (different from spoke-side client_lead_id). */
  hubLeadId?: string;
  /** HTTP status from hub. */
  status?: number;
  /** Sanitized error message (safe to log). */
  error?: string;
  /** True if error was a timeout or network failure (eligible for fallback queue). */
  isRetriable?: boolean;
}

export class HubSyncError extends Error {
  constructor(
    message: string,
    public readonly retriable: boolean,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "HubSyncError";
  }
}

/**
 * Send a TransportLead to hub. Caller should fallback-queue on { ok: false, isRetriable: true }.
 * Non-retriable errors (validation, auth) should be alerted — they indicate config drift.
 */
export async function sendLeadToHub(
  deps: HubSyncDeps,
  lead: TransportLead,
  options: HubSyncOptions = {},
): Promise<HubSyncResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const maxRetries = options.maxRetries ?? 1;
  const backoffBaseMs = options.backoffBaseMs ?? 100;

  const url = `${deps.hubBaseUrl.replace(/\/+$/, "")}/api/leads`;

  let lastError: { error: string; retriable: boolean; status?: number } | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const jitter = Math.random() * backoffBaseMs;
      const delay = backoffBaseMs * Math.pow(2, attempt - 1) + jitter;
      await sleep(delay);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BP-Client-Key": deps.apiKey,
          "X-Lead-Id": lead.client_lead_id, // idempotency hint
        },
        body: JSON.stringify(lead),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        // 200 OR 201 OR 202 (queued)
        let body: { id?: string } = {};
        try {
          body = (await res.json()) as { id?: string };
        } catch {
          /* body may be empty on 202 — that's fine */
        }
        const result: HubSyncResult = { ok: true, status: res.status };
        if (body.id !== undefined) result.hubLeadId = body.id;
        return result;
      }

      // 4xx — non-retriable (validation/auth bug, our problem)
      // 5xx — retriable (hub transient)
      const retriable = res.status >= 500;
      const errorMsg = `hub returned ${res.status}`;
      lastError = { error: errorMsg, retriable, status: res.status };

      if (!retriable) {
        return { ok: false, status: res.status, error: errorMsg, isRetriable: false };
      }
      // else loop to retry
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const errorMsg = isAbort ? "hub request timeout" : err instanceof Error ? err.message : "hub network error";
      lastError = { error: errorMsg, retriable: true };
      // network / timeout — retriable
    }
  }

  return {
    ok: false,
    error: lastError?.error ?? "hub sync failed",
    isRetriable: lastError?.retriable ?? true,
    ...(lastError?.status !== undefined && { status: lastError.status }),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
