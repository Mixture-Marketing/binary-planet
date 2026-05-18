/**
 * Webhook idempotency tracking.
 *
 * Strategy: insert event with UNIQUE(source, external_event_id) constraint.
 * Stripe + P24 retry on failure — we MUST be idempotent.
 */

export type WebhookSource = "stripe" | "przelewy24" | "github" | "fakturownia" | "resend";

export interface RecordWebhookInput {
  source: WebhookSource;
  externalEventId: string;
  eventType: string;
  signatureVerified: boolean;
  /** Optional R2 key where full payload archived. */
  payloadR2Key?: string;
}

export interface RecordWebhookResult {
  /** True if this was a fresh event (we should process). */
  isNew: boolean;
  /** True if this is a duplicate replay (already processed — return 200 to caller without re-processing). */
  isDuplicate: boolean;
  /** Hub row id. */
  id: number;
  /** If duplicate, the existing row's status. */
  existingStatus?: string;
}

/**
 * Record a webhook event in receiving state. Returns isDuplicate=true if previously seen.
 * Caller should:
 *   - if isDuplicate=true → return 200 without re-processing
 *   - if isNew=true → process, then call markProcessed/markFailed
 */
export async function recordWebhookReceived(
  db: D1Database,
  input: RecordWebhookInput,
): Promise<RecordWebhookResult> {
  // Try insert — if conflict, fetch existing
  const insert = await db
    .prepare(
      `INSERT INTO webhook_events (source, external_event_id, event_type, status, signature_verified, payload_r2_key, received_at)
       VALUES (?, ?, ?, 'received', ?, ?, datetime('now'))
       ON CONFLICT (source, external_event_id) DO NOTHING
       RETURNING id, status`,
    )
    .bind(
      input.source,
      input.externalEventId,
      input.eventType,
      input.signatureVerified ? 1 : 0,
      input.payloadR2Key ?? null,
    )
    .first<{ id: number; status: string }>();

  if (insert) {
    return { isNew: true, isDuplicate: false, id: insert.id };
  }

  // Conflict — fetch existing
  const existing = await db
    .prepare(`SELECT id, status FROM webhook_events WHERE source = ? AND external_event_id = ? LIMIT 1`)
    .bind(input.source, input.externalEventId)
    .first<{ id: number; status: string }>();
  if (!existing) {
    // Race condition or DB inconsistency — treat as new with caveat
    throw new Error(
      `recordWebhookReceived: ON CONFLICT triggered but no row found for ${input.source}/${input.externalEventId}`,
    );
  }
  return { isNew: false, isDuplicate: true, id: existing.id, existingStatus: existing.status };
}

export async function markWebhookProcessed(db: D1Database, id: number): Promise<void> {
  await db
    .prepare(
      `UPDATE webhook_events
          SET status = 'processed', processed_at = datetime('now')
        WHERE id = ?`,
    )
    .bind(id)
    .run();
}

export async function markWebhookFailed(
  db: D1Database,
  id: number,
  error: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE webhook_events
          SET status = 'failed', error = ?, retry_count = retry_count + 1
        WHERE id = ?`,
    )
    .bind(error, id)
    .run();
}
