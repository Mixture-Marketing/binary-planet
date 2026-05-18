/**
 * Per-klient budget caps. Checked before expensive operations to prevent runaway costs.
 *
 * Usage:
 *   const budget = await checkBudget(env.DB, clientId, "ai_monthly_usd");
 *   if (budget.exceeded) return { skipped: true, reason: "budget" };
 *
 * Implementation: queries D1 ai_calls / payments / sms_sends tables to compute current
 * month's spend, compares against client.budget_caps_json[category].
 */

import type { BudgetCategory } from "./types.js";

export interface BudgetCheckResult {
  category: BudgetCategory;
  /** Current month-to-date spend in the category's natural unit. */
  spent: number;
  /** Cap value. 0 or undefined = unlimited. */
  cap?: number;
  /** True if spent >= cap. False if no cap configured. */
  exceeded: boolean;
  /** Percentage of cap consumed (0–100+). null if no cap. */
  usagePct: number | null;
}

/**
 * Generic budget check. Caller provides D1 query function that returns current spend.
 * Engine is pure — D1 access happens via callback (testable, framework-agnostic).
 */
export interface BudgetCheckInput {
  clientId: string;
  category: BudgetCategory;
  /** Cap value (typically from clients.budget_caps_json[category]). 0/undefined = unlimited. */
  cap?: number;
  /** Async fn that returns current month-to-date spend. Caller decides D1 query. */
  fetchSpent: () => Promise<number>;
}

export async function checkBudget(input: BudgetCheckInput): Promise<BudgetCheckResult> {
  const spent = await input.fetchSpent();
  const cap = input.cap;
  const exceeded = cap !== undefined && cap > 0 && spent >= cap;
  const usagePct = cap !== undefined && cap > 0 ? (spent / cap) * 100 : null;
  const result: BudgetCheckResult = {
    category: input.category,
    spent,
    exceeded,
    usagePct,
  };
  if (cap !== undefined) result.cap = cap;
  return result;
}

/**
 * Ready-made D1 spend queries for our standard categories.
 * Use as `fetchSpent` callback in checkBudget().
 */

export function aiSpendThisMonthQuery(db: D1Database, clientId: string): () => Promise<number> {
  return async () => {
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(cost_grosze), 0) AS total
           FROM ai_calls
          WHERE client_id = ?
            AND occurred_at >= datetime('now', 'start of month')`,
      )
      .bind(clientId)
      .first<{ total: number }>();
    // cost_grosze is in 1/100 USD (we use grosze convention but it's actually USD/100)
    // For UI display: cost_grosze / 100 = USD
    return (row?.total ?? 0) / 100;
  };
}

export function smsSpendThisMonthQuery(db: D1Database, clientId: string): () => Promise<number> {
  return async () => {
    // review_requests has channel='sms' + cost (~ 0.10 zł per SMS for SMSAPI prepaid)
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS count
           FROM review_requests
          WHERE client_id = ? AND channel = 'sms'
            AND created_at >= datetime('now', 'start of month')`,
      )
      .bind(clientId)
      .first<{ count: number }>();
    // Cost approximation: 0.12 zł per SMS (SMSAPI Pro tier average)
    return (row?.count ?? 0) * 0.12;
  };
}
