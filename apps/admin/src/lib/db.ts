/**
 * D1 query helpers — read-only access to mm-control-plane database.
 *
 * Admin panel reads aggregate data + per-klient detail. No writes here
 * (writes happen via control-plane API to maintain audit trail).
 *
 * NOTE: PII columns (*_enc) returned encrypted — caller decrypts via web-core/forms
 * with PII_ENCRYPTION_KEY when displaying. v0.1 shows hashes only.
 */

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  leadsToday: number;
  leadsThisWeek: number;
  openAlerts: number;
}

export async function getDashboardStats(db: D1Database): Promise<DashboardStats> {
  const [clients, leadsToday, leadsWeek, alerts] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
         FROM clients`,
      )
      .first<{ total: number; active: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS c FROM leads WHERE date(created_at) = date('now') AND deleted_at IS NULL`)
      .first<{ c: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS c FROM leads WHERE created_at >= datetime('now', '-7 days') AND deleted_at IS NULL`)
      .first<{ c: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS c FROM alerts WHERE status IN ('open', 'acked')`)
      .first<{ c: number }>(),
  ]);

  return {
    totalClients: clients?.total ?? 0,
    activeClients: clients?.active ?? 0,
    leadsToday: leadsToday?.c ?? 0,
    leadsThisWeek: leadsWeek?.c ?? 0,
    openAlerts: alerts?.c ?? 0,
  };
}

export interface ClientRow {
  id: string;
  business_name: string;
  industry: string;
  city: string;
  tier: string;
  status: string;
  primary_domain: string | null;
  created_at: string;
  activated_at: string | null;
}

export async function listClients(
  db: D1Database,
  options: { limit?: number; status?: string } = {},
): Promise<ClientRow[]> {
  const limit = options.limit ?? 100;
  let sql = `SELECT id, business_name, industry, city, tier, status, primary_domain, created_at, activated_at
               FROM clients`;
  const binds: unknown[] = [];
  if (options.status) {
    sql += " WHERE status = ?";
    binds.push(options.status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  binds.push(limit);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db.prepare(sql).bind(...binds) as any).all();
  return (result?.results ?? []) as ClientRow[];
}

export interface ClientDetail extends ClientRow {
  legal_name: string | null;
  nip: string | null;
  regon: string | null;
  theme_preset: string;
  subtype_schema: string;
  has_lock_in: number;
  lock_in_until: string | null;
  modules_json: string;
  notes: string | null;
}

export async function getClient(db: D1Database, id: string): Promise<ClientDetail | null> {
  return await db
    .prepare(
      `SELECT id, business_name, legal_name, nip, regon, industry, subtype_schema, theme_preset,
              city, tier, status, primary_domain, created_at, activated_at, has_lock_in, lock_in_until,
              modules_json, notes
         FROM clients WHERE id = ? LIMIT 1`,
    )
    .bind(id)
    .first<ClientDetail>();
}

// Provisioning state (Track 14/17/18 — joined view of client + config + audit)
export interface ProvisioningStep {
  step: string;
  ok: boolean;
  ts: string;
  message: string;
  dry_run?: boolean;
  extra?: Record<string, unknown>;
}

export interface ProvisioningState {
  client_id: string;
  provisioning_status: string | null;
  wizard_version: string | null;
  generated_at: string | null;
  provisioning_started_at: string | null;
  provisioning_finished_at: string | null;
  provisioning_error: string | null;
  steps: ProvisioningStep[];
  github_repo_url: string | null;
  cf_worker_name: string | null;
  primary_domain: string | null;
  deploy_email_sent_at: string | null;
}

export async function getProvisioning(
  db: D1Database,
  clientId: string,
): Promise<ProvisioningState | null> {
  const row = await db
    .prepare(
      `SELECT p.client_id, p.provisioning_status, p.wizard_version, p.generated_at,
              p.provisioning_started_at, p.provisioning_finished_at, p.provisioning_error,
              p.steps_json,
              c.github_repo_url, c.cf_worker_name, c.primary_domain
         FROM client_provisioning_configs p
         JOIN clients c ON c.id = p.client_id
        WHERE p.client_id = ?
        LIMIT 1`,
    )
    .bind(clientId)
    .first<{
      client_id: string;
      provisioning_status: string;
      wizard_version: string;
      generated_at: string;
      provisioning_started_at: string | null;
      provisioning_finished_at: string | null;
      provisioning_error: string | null;
      steps_json: string;
      github_repo_url: string | null;
      cf_worker_name: string | null;
      primary_domain: string | null;
    }>();
  if (!row) return null;

  let steps: ProvisioningStep[] = [];
  try {
    const parsed = JSON.parse(row.steps_json) as unknown;
    if (Array.isArray(parsed)) steps = parsed as ProvisioningStep[];
  } catch {
    /* empty/malformed */
  }

  const lastEmail = await db
    .prepare(
      `SELECT occurred_at FROM audit_log
        WHERE client_id = ? AND action = 'deploy.email_sent'
        ORDER BY id DESC LIMIT 1`,
    )
    .bind(clientId)
    .first<{ occurred_at: string }>();

  return {
    client_id: row.client_id,
    provisioning_status: row.provisioning_status,
    wizard_version: row.wizard_version,
    generated_at: row.generated_at,
    provisioning_started_at: row.provisioning_started_at,
    provisioning_finished_at: row.provisioning_finished_at,
    provisioning_error: row.provisioning_error,
    steps,
    github_repo_url: row.github_repo_url,
    cf_worker_name: row.cf_worker_name,
    primary_domain: row.primary_domain,
    deploy_email_sent_at: lastEmail?.occurred_at ?? null,
  };
}

/** Reset a failed/done provisioning row so the next cron pass picks it up again. */
export async function resetProvisioning(db: D1Database, clientId: string): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE client_provisioning_configs
          SET provisioning_status = 'pending',
              provisioning_started_at = NULL,
              provisioning_finished_at = NULL,
              provisioning_error = NULL,
              steps_json = '[]'
        WHERE client_id = ?
          AND provisioning_status IN ('failed', 'done', 'running')`,
    )
    .bind(clientId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Recent provisioning attempts for the /provisioning overview page. */
export interface ProvisioningSummary {
  client_id: string;
  business_name: string;
  provisioning_status: string;
  provisioning_started_at: string | null;
  provisioning_finished_at: string | null;
  provisioning_error: string | null;
  cf_worker_name: string | null;
  primary_domain: string | null;
}

export async function listProvisioning(
  db: D1Database,
  opts: { status?: string; limit?: number } = {},
): Promise<ProvisioningSummary[]> {
  const limit = opts.limit ?? 50;
  let sql = `
    SELECT p.client_id, c.business_name, p.provisioning_status,
           p.provisioning_started_at, p.provisioning_finished_at, p.provisioning_error,
           c.cf_worker_name, c.primary_domain
      FROM client_provisioning_configs p
      JOIN clients c ON c.id = p.client_id`;
  const binds: unknown[] = [];
  if (opts.status && opts.status !== "all") {
    sql += ` WHERE p.provisioning_status = ?`;
    binds.push(opts.status);
  }
  sql += ` ORDER BY COALESCE(p.provisioning_finished_at, p.provisioning_started_at, p.generated_at) DESC LIMIT ?`;
  binds.push(limit);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db.prepare(sql).bind(...binds) as any).all();
  return (result?.results ?? []) as ProvisioningSummary[];
}

export interface LeadRow {
  id: string;
  client_id: string;
  source: string;
  service_interest: string | null;
  estimated_value_pln: number | null;
  email_hash: string;
  phone_hash: string | null;
  status: string;
  created_at: string;
  is_hot: number;
}

export async function listLeadsForClient(
  db: D1Database,
  clientId: string,
  limit = 50,
): Promise<LeadRow[]> {
  const result = await db
    .prepare(
      `SELECT id, client_id, source, service_interest, estimated_value_pln, email_hash, phone_hash, status, created_at, is_hot
         FROM leads
        WHERE client_id = ? AND deleted_at IS NULL
        ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(clientId, limit)
    .all<LeadRow>();
  return result.results ?? [];
}

export async function listRecentLeads(db: D1Database, limit = 50): Promise<(LeadRow & { business_name: string })[]> {
  const result = await db
    .prepare(
      `SELECT l.id, l.client_id, l.source, l.service_interest, l.estimated_value_pln,
              l.email_hash, l.phone_hash, l.status, l.created_at, l.is_hot,
              c.business_name
         FROM leads l
         JOIN clients c ON c.id = l.client_id
        WHERE l.deleted_at IS NULL
        ORDER BY l.created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<LeadRow & { business_name: string }>();
  return result.results ?? [];
}

export interface AlertRow {
  id: string;
  severity: "P1" | "P2" | "P3" | "P4";
  alert_type: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: "open" | "acked" | "resolved" | "auto_resolved" | "flapping";
  fired_at: string;
  acked_at: string | null;
  runbook_url: string | null;
}

export interface AlertRowDetailed extends AlertRow {
  resource_type: string | null;
  resource_id: string | null;
  dedup_count: number;
  metadata_json: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export async function listAlerts(
  db: D1Database,
  opts: { status?: string; limit?: number } = {},
): Promise<AlertRowDetailed[]> {
  let sql = `SELECT id, severity, alert_type, client_id, resource_type, resource_id, title, description,
                    status, fired_at, acked_at, resolved_at, resolved_by, runbook_url, dedup_count, metadata_json
               FROM alerts`;
  const binds: unknown[] = [];
  if (opts.status === "open") {
    sql += ` WHERE status IN ('open','acked')`;
  } else if (opts.status && opts.status !== "all") {
    sql += ` WHERE status = ?`;
    binds.push(opts.status);
  }
  sql += ` ORDER BY
             CASE severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END ASC,
             fired_at DESC LIMIT ?`;
  binds.push(opts.limit ?? 100);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db.prepare(sql).bind(...binds) as any).all();
  return (result?.results ?? []) as AlertRowDetailed[];
}

export async function ackAlert(db: D1Database, id: string, actor: string): Promise<boolean> {
  const r = await db
    .prepare(`UPDATE alerts SET status = 'acked', acked_at = datetime('now'), acked_by = ? WHERE id = ? AND status = 'open'`)
    .bind(actor, id)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

export async function resolveAlert(db: D1Database, id: string, actor: string): Promise<boolean> {
  const r = await db
    .prepare(`UPDATE alerts SET status = 'resolved', resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND status IN ('open','acked')`)
    .bind(actor, id)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

export async function listOpenAlerts(db: D1Database, limit = 50): Promise<AlertRow[]> {
  const result = await db
    .prepare(
      `SELECT id, severity, alert_type, client_id, title, description, status, fired_at, acked_at, runbook_url
         FROM alerts
        WHERE status IN ('open', 'acked')
        ORDER BY
          CASE severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END ASC,
          fired_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<AlertRow>();
  return result.results ?? [];
}
