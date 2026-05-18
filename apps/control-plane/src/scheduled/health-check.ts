/**
 * Synthetic monitor — every 5 min, fetch each active klient's primary domain.
 * Records HTTP status + response time in health_checks.
 * Triggers P1 alert if a klient has consecutive failures.
 *
 * Reference: plan/W-12-dni-operacyjnych.md W.3.3
 */

import type { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";

interface ClientRow {
  id: string;
  primary_domain: string;
}

export interface HealthCheckResult {
  checked: number;
  failed: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

export async function healthCheck(env: Env, log: Logger): Promise<HealthCheckResult> {
  const clients = await env.DB.prepare(
    `SELECT id, primary_domain FROM clients
      WHERE status = 'active' AND primary_domain IS NOT NULL`,
  ).all<ClientRow>();

  const list = clients.results ?? [];
  if (list.length === 0) {
    return { checked: 0, failed: 0 };
  }

  let failed = 0;
  // Run in parallel but cap concurrency at 50 to avoid thundering herd on our own
  // outbound limits. For < 50 clients, this is just Promise.all.
  const BATCH = 50;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (client) => {
        const result = await probe(client.primary_domain);
        if (!result.ok) failed++;

        await env.DB.prepare(
          `INSERT INTO health_checks (client_id, checked_at, http_status, response_time_ms, uptime, error_message)
           VALUES (?, datetime('now'), ?, ?, ?, ?)`,
        )
          .bind(
            client.id,
            result.status ?? null,
            result.durationMs,
            result.ok ? 1 : 0,
            result.error ?? null,
          )
          .run();
      }),
    );
  }

  log.info("health_check.batch_done", { checked: list.length, failed });

  return { checked: list.length, failed };
}

interface ProbeResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
}

async function probe(domain: string): Promise<ProbeResult> {
  const url = `https://${domain}/`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cf: { cacheTtl: 0 },
    });
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : "probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
