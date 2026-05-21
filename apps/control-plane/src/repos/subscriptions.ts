/**
 * Subscriptions repo — DB helpers for Stripe webhook dispatchers.
 */

export interface SubscriptionRow {
  id: string;
  client_id: string;
  provider: "stripe" | "przelewy24";
  external_id: string;
  external_customer_id: string | null;
  monthly_amount_grosze: number;
  currency: string;
  tier: "starter" | "standard" | "premium" | "professional";
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
}

function isoFromUnix(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined) return null;
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Upsert subscription based on Stripe external id. Used in checkout.session.completed + subscription.updated. */
export async function upsertSubscriptionFromStripe(
  db: D1Database,
  input: {
    client_id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    status: string;
    tier: "starter" | "standard" | "premium" | "professional";
    monthly_amount_grosze: number;
    currency: string;
    current_period_start_unix?: number;
    current_period_end_unix?: number;
    cancel_at_unix?: number | null;
    canceled_at_unix?: number | null;
  },
): Promise<{ id: string; created: boolean }> {
  // Check if a row already exists for this stripe sub id
  const existing = await db
    .prepare(`SELECT id FROM subscriptions WHERE provider = 'stripe' AND external_id = ? LIMIT 1`)
    .bind(input.stripe_subscription_id)
    .first<{ id: string }>();

  const periodStart = isoFromUnix(input.current_period_start_unix);
  const periodEnd = isoFromUnix(input.current_period_end_unix);
  const cancelAt = isoFromUnix(input.cancel_at_unix);
  const canceledAt = isoFromUnix(input.canceled_at_unix);

  if (existing) {
    await db
      .prepare(
        `UPDATE subscriptions
            SET status = ?,
                tier = ?,
                monthly_amount_grosze = ?,
                currency = ?,
                external_customer_id = ?,
                current_period_start = ?,
                current_period_end = ?,
                cancel_at = ?,
                canceled_at = ?
          WHERE id = ?`,
      )
      .bind(
        input.status,
        input.tier,
        input.monthly_amount_grosze,
        input.currency,
        input.stripe_customer_id,
        periodStart,
        periodEnd,
        cancelAt,
        canceledAt,
        existing.id,
      )
      .run();
    return { id: existing.id, created: false };
  }

  const id = `sub_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  await db
    .prepare(
      `INSERT INTO subscriptions (
         id, client_id, provider, external_id, external_customer_id,
         monthly_amount_grosze, currency, tier, status,
         current_period_start, current_period_end, cancel_at, canceled_at
       ) VALUES (?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.client_id,
      input.stripe_subscription_id,
      input.stripe_customer_id,
      input.monthly_amount_grosze,
      input.currency,
      input.tier,
      input.status,
      periodStart,
      periodEnd,
      cancelAt,
      canceledAt,
    )
    .run();
  return { id, created: true };
}

/** Update lifecycle (status + canceled_at) — used by subscription.updated / deleted. */
export async function updateSubscriptionLifecycle(
  db: D1Database,
  stripeSubId: string,
  patch: { status?: string; canceled_at_unix?: number | null; cancel_at_unix?: number | null },
): Promise<boolean> {
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (patch.status !== undefined) { sets.push("status = ?"); binds.push(patch.status); }
  if (patch.canceled_at_unix !== undefined) { sets.push("canceled_at = ?"); binds.push(isoFromUnix(patch.canceled_at_unix)); }
  if (patch.cancel_at_unix !== undefined) { sets.push("cancel_at = ?"); binds.push(isoFromUnix(patch.cancel_at_unix)); }
  if (sets.length === 0) return false;
  binds.push(stripeSubId);
  const result = await db
    .prepare(`UPDATE subscriptions SET ${sets.join(", ")} WHERE provider = 'stripe' AND external_id = ?`)
    .bind(...binds)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** Map status → clients.status (gates 'active' on Stripe being healthy). */
export const CLIENT_STATUS_FROM_STRIPE: Record<string, string> = {
  active: "active",
  trialing: "active",
  past_due: "active",       // grace period — still show klient site
  unpaid: "suspended",
  canceled: "churned",
  incomplete: "pending",
  incomplete_expired: "churned",
  paused: "paused",
};

/** Record a payment row from invoice.paid event. */
export async function recordStripePayment(
  db: D1Database,
  input: {
    client_id: string;
    subscription_id?: string | null;
    stripe_invoice_id: string;
    amount_grosze: number;
    currency: string;
    status: "succeeded" | "failed";
    paid_at_unix?: number | null;
    failure_message?: string;
  },
): Promise<void> {
  const id = `pmt_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  await db
    .prepare(
      `INSERT INTO payments (
         id, client_id, subscription_id, amount_grosze, currency, type, provider,
         external_id, status, failure_message, paid_at
       ) VALUES (?, ?, ?, ?, ?, 'monthly', 'stripe', ?, ?, ?, ?)
       ON CONFLICT (provider, external_id) DO UPDATE
         SET status = excluded.status,
             paid_at = excluded.paid_at,
             failure_message = excluded.failure_message`,
    )
    .bind(
      id,
      input.client_id,
      input.subscription_id ?? null,
      input.amount_grosze,
      input.currency,
      input.stripe_invoice_id,
      input.status,
      input.failure_message ?? null,
      isoFromUnix(input.paid_at_unix),
    )
    .run();
}
