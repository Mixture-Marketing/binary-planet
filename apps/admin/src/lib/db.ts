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
