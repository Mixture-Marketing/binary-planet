/**
 * Fallback queue for leads when hub is unreachable (J.4 — failure mode).
 *
 * Strategy:
 *   - Spoke stores TransportLead in KV with deterministic key
 *   - Cron in spoke (every 5 min) drains queue → POST to hub
 *   - On success: delete from KV
 *   - On failure: increment retry count, exponential backoff
 *   - After 24h of failures: critical alert + escalate (P1)
 *
 * Why KV not Durable Object: simpler, eventually consistent OK for queue draining.
 * Why not Queues: CF Queues is paid, KV gets us 90% of value with free tier.
 *
 * Key format: leadq:<clientId>:<priority>:<isoTimestamp>:<clientLeadId>
 *   priority: '1' (high — newer leads), '5' (normal). Lex order = drain order.
 */

import type { TransportLead } from "./types.js";

const KEY_PREFIX = "leadq";
const MAX_RETRIES = 288; // 5min cron × 288 = 24h before P1
const MAX_ITEMS_PER_DRAIN = 50; // batch size — avoid timing out cron Worker

export interface FallbackQueueDeps {
  kv: KVNamespace;
}

export interface EnqueuedLead {
  /** TransportLead payload as serialized JSON. */
  lead: TransportLead;
  /** How many drain attempts have failed. */
  retries: number;
  /** ISO of first enqueue. */
  enqueued_at: string;
  /** ISO of last attempt. */
  last_attempted_at?: string;
  /** Last error message (no PII). */
  last_error?: string;
}

export async function enqueueLead(
  deps: FallbackQueueDeps,
  lead: TransportLead,
  priority: "high" | "normal" = "high",
): Promise<string> {
  const priorityFlag = priority === "high" ? "1" : "5";
  const key = `${KEY_PREFIX}:${lead.client_id}:${priorityFlag}:${lead.spoke_received_at}:${lead.client_lead_id}`;
  const value: EnqueuedLead = {
    lead,
    retries: 0,
    enqueued_at: lead.spoke_received_at,
  };
  // No TTL — these MUST persist until drained successfully.
  await deps.kv.put(key, JSON.stringify(value));
  return key;
}

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  /** Leads abandoned (retries >= MAX_RETRIES). */
  abandoned: number;
  errors: string[];
}

export interface DrainOptions {
  clientId: string;
  maxItems?: number;
  /** Function that attempts to deliver a lead to hub. Returns true on success. */
  sendToHub: (lead: TransportLead) => Promise<{ ok: boolean; error?: string }>;
  /** Optional hook called for each abandoned lead (e.g. write to dead-letter log). */
  onAbandon?: (item: EnqueuedLead, key: string) => Promise<void>;
}

/**
 * Drain queue for a single klient. Caller (cron) should loop over all active klientów.
 * Caller responsible for ordering (we return items sorted by priority+timestamp via KV list).
 */
export async function drainQueue(deps: FallbackQueueDeps, options: DrainOptions): Promise<DrainResult> {
  const max = options.maxItems ?? MAX_ITEMS_PER_DRAIN;
  const listing = await deps.kv.list({ prefix: `${KEY_PREFIX}:${options.clientId}:`, limit: max });

  const result: DrainResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    abandoned: 0,
    errors: [],
  };

  for (const entry of listing.keys) {
    const raw = await deps.kv.get(entry.name);
    if (raw === null) continue;

    let item: EnqueuedLead;
    try {
      item = JSON.parse(raw) as EnqueuedLead;
    } catch {
      // Corrupt entry — skip + delete
      await deps.kv.delete(entry.name);
      result.errors.push(`corrupt entry: ${entry.name}`);
      continue;
    }

    result.attempted++;

    let sendResult: { ok: boolean; error?: string };
    try {
      sendResult = await options.sendToHub(item.lead);
    } catch (err) {
      sendResult = { ok: false, error: err instanceof Error ? err.message : "unknown error" };
    }

    if (sendResult.ok) {
      await deps.kv.delete(entry.name);
      result.succeeded++;
      continue;
    }

    // Failed — increment retries
    const updated: EnqueuedLead = {
      ...item,
      retries: item.retries + 1,
      last_attempted_at: new Date().toISOString(),
    };
    if (sendResult.error !== undefined) updated.last_error = sendResult.error;

    if (updated.retries >= MAX_RETRIES) {
      if (options.onAbandon) {
        try {
          await options.onAbandon(updated, entry.name);
        } catch {
          /* swallow — abandon hook must not block drain */
        }
      }
      await deps.kv.delete(entry.name);
      result.abandoned++;
      if (sendResult.error !== undefined) {
        result.errors.push(`abandoned ${item.lead.client_lead_id}: ${sendResult.error}`);
      }
    } else {
      await deps.kv.put(entry.name, JSON.stringify(updated));
      result.failed++;
    }
  }

  return result;
}

/** Count items still in queue for a klient. Useful for dashboard widgets + alerts. */
export async function queueDepth(deps: FallbackQueueDeps, clientId: string): Promise<number> {
  // KV list is paginated — for large queues this needs cursor handling.
  // At our scale (queue should be small + transient) one page suffices.
  const listing = await deps.kv.list({ prefix: `${KEY_PREFIX}:${clientId}:`, limit: 1000 });
  return listing.keys.length;
}

/** Maximum retries (exposed for tests + monitoring). */
export const MAX_QUEUE_RETRIES = MAX_RETRIES;
