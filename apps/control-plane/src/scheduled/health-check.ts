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

/** Critical own-infrastructure services (probed every cron tick alongside klient sites). */
const INFRA_SERVICES = [
  { id: "system_api", url: "https://api.mixturemarketing.pl/api/health" },
  { id: "system_app", url: "https://app.mixturemarketing.pl/login" },
  { id: "system_panel", url: "https://panel.mixturemarketing.pl/login" },
  { id: "system_marketing", url: "https://mixturemarketing.pl/" },
] as const;

export async function healthCheck(env: Env, log: Logger): Promise<HealthCheckResult> {
  let checked = 0;
  let failed = 0;

  // 1a. system_api self-check — CF Workers can't fetch their own hostname (522).
  // Instead: run a D1 ping (we're already executing inside the api Worker, so if this
  // succeeds + cron itself fired, api is reachable).
  {
    const start = Date.now();
    let dbOk = false;
    let dbError: string | undefined;
    try {
      await env.DB.prepare("SELECT 1 as ping").first<{ ping: number }>();
      dbOk = true;
    } catch (e) {
      dbError = e instanceof Error ? e.message : "db ping failed";
    }
    const r: ProbeResult = { ok: dbOk, status: dbOk ? 200 : undefined, durationMs: Date.now() - start, ...(dbError && { error: dbError }) };
    checked++;
    if (!r.ok) failed++;
    await env.DB
      .prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
         VALUES ('system', ?, 'service', 'system_api', ?, ?)`,
      )
      .bind(
        r.ok ? "infra.probe.ok" : "infra.probe.failed",
        r.ok ? "info" : "warn",
        JSON.stringify({ url: "self:d1-ping", status: r.status, duration_ms: r.durationMs, error: r.error }),
      )
      .run();
    if (!r.ok) await maybeRaiseInfraAlert(env, "system_api", "self:d1-ping", r, log);
    else await autoResolveAlert(env, `infra:system_api:down`);
  }

  // 1b. Other infra services — real HTTP probes
  await Promise.all(
    INFRA_SERVICES.filter((s) => s.id !== "system_api").map(async (svc) => {
      const r = await probe(svc.url);
      checked++;
      if (!r.ok) failed++;
      await env.DB
        .prepare(
          `INSERT INTO audit_log (actor, action, resource_type, resource_id, severity, metadata_json)
           VALUES ('system', ?, 'service', ?, ?, ?)`,
        )
        .bind(
          r.ok ? "infra.probe.ok" : "infra.probe.failed",
          svc.id,
          r.ok ? "info" : "warn",
          JSON.stringify({ url: svc.url, status: r.status, duration_ms: r.durationMs, error: r.error }),
        )
        .run();

      if (!r.ok) await maybeRaiseInfraAlert(env, svc.id, svc.url, r, log);
      else await autoResolveAlert(env, `infra:${svc.id}:down`);
    }),
  );

  // 2. Klient site probes
  const clients = await env.DB
    .prepare(
      `SELECT id, primary_domain FROM clients
        WHERE status = 'active' AND primary_domain IS NOT NULL`,
    )
    .all<ClientRow>();

  const list = clients.results ?? [];
  const BATCH = 50;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (client) => {
        const result = await probe(`https://${client.primary_domain}/`);
        checked++;
        if (!result.ok) failed++;
        await env.DB
          .prepare(
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
        if (!result.ok) await maybeRaiseClientAlert(env, client.id, client.primary_domain, result, log);
        else await autoResolveAlert(env, `client:${client.id}:site_down`);
      }),
    );
  }

  log.info("health_check.batch_done", { checked, failed, infra: INFRA_SERVICES.length, klient: list.length });
  return { checked, failed };
}

/**
 * Raise a P1/P2 alert when an infra service has 2+ consecutive failed probes.
 * Dedup via `dedup_key` so we don't insert N rows for a long outage.
 */
async function maybeRaiseInfraAlert(
  env: Env,
  serviceId: string,
  url: string,
  probe: ProbeResult,
  log: Logger,
): Promise<void> {
  // Count recent infra.probe.* rows for this service in the last 20 minutes
  const recent = await env.DB
    .prepare(
      `SELECT action FROM audit_log
        WHERE resource_type = 'service' AND resource_id = ?
          AND action IN ('infra.probe.ok','infra.probe.failed')
          AND occurred_at >= datetime('now', '-20 minutes')
        ORDER BY id DESC LIMIT 3`,
    )
    .bind(serviceId)
    .all<{ action: string }>();

  const last3 = (recent.results ?? []).map((r) => r.action);
  const consecutiveFailed = last3.length >= 2 && last3.slice(0, 2).every((a) => a === "infra.probe.failed");
  if (!consecutiveFailed) return;

  const dedupKey = `infra:${serviceId}:down`;
  // Skip if an open alert with this dedup_key already exists
  const existing = await env.DB
    .prepare(`SELECT id, dedup_count FROM alerts WHERE dedup_key = ? AND status = 'open' LIMIT 1`)
    .bind(dedupKey)
    .first<{ id: number; dedup_count: number }>();
  if (existing) {
    await env.DB
      .prepare(`UPDATE alerts SET dedup_count = dedup_count + 1 WHERE id = ?`)
      .bind(existing.id)
      .run();
    return;
  }
  await env.DB
    .prepare(
      `INSERT INTO alerts (severity, alert_type, resource_type, resource_id, title, description, status, fired_at, dedup_key, dedup_count, metadata_json)
       VALUES ('P1','infra_down','service',?,?,?,'open',datetime('now'),?,1,?)`,
    )
    .bind(
      serviceId,
      `🚨 ${serviceId} DOWN`,
      `${url} returned ${probe.status ?? "no response"} (${probe.error ?? "no error"}). 2+ consecutive failed probes.`,
      dedupKey,
      JSON.stringify({ url, last_probe: probe }),
    )
    .run();
  log.warn("alert.infra_down", { service_id: serviceId, url });
}

async function maybeRaiseClientAlert(
  env: Env,
  clientId: string,
  domain: string,
  probe: ProbeResult,
  log: Logger,
): Promise<void> {
  const recent = await env.DB
    .prepare(
      `SELECT uptime FROM health_checks
        WHERE client_id = ?
        ORDER BY id DESC LIMIT 3`,
    )
    .bind(clientId)
    .all<{ uptime: number }>();
  const last3 = recent.results ?? [];
  const consecutiveFailed = last3.length >= 2 && last3.slice(0, 2).every((r) => r.uptime === 0);
  if (!consecutiveFailed) return;

  const dedupKey = `client:${clientId}:site_down`;
  const existing = await env.DB
    .prepare(`SELECT id FROM alerts WHERE dedup_key = ? AND status = 'open' LIMIT 1`)
    .bind(dedupKey)
    .first<{ id: number }>();
  if (existing) {
    await env.DB.prepare(`UPDATE alerts SET dedup_count = dedup_count + 1 WHERE id = ?`).bind(existing.id).run();
    return;
  }
  await env.DB
    .prepare(
      `INSERT INTO alerts (severity, alert_type, client_id, resource_type, resource_id, title, description, status, fired_at, dedup_key, dedup_count, metadata_json)
       VALUES ('P2','site_down',?,'client',?,?,?,'open',datetime('now'),?,1,?)`,
    )
    .bind(
      clientId,
      clientId,
      `Strona klienta nieosiągalna: ${domain}`,
      `https://${domain}/ returned ${probe.status ?? "no response"}. 2+ consecutive failed probes.`,
      dedupKey,
      JSON.stringify({ domain, last_probe: probe }),
    )
    .run();
  log.warn("alert.client_site_down", { client_id: clientId, domain });
}

interface ProbeResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
}

/** Mark an open alert resolved when its underlying condition recovers. */
async function autoResolveAlert(env: Env, dedupKey: string): Promise<void> {
  await env.DB
    .prepare(
      `UPDATE alerts
          SET status = 'resolved',
              resolved_at = datetime('now'),
              resolved_by = 'auto:recovery'
        WHERE dedup_key = ? AND status = 'open'`,
    )
    .bind(dedupKey)
    .run();
}

async function probe(urlOrDomain: string): Promise<ProbeResult> {
  // Accept full URL or bare domain for backwards compat
  const url = urlOrDomain.startsWith("http") ? urlOrDomain : `https://${urlOrDomain}/`;
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
