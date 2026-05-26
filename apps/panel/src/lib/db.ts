/**
 * D1 query helpers — strictly scoped by client_id (klient sees only their data).
 *
 * v0.1: PII (name/email/phone) shown as hashes (suffix of sha256) until decryption
 * pipeline lands. Track 6 (Stripe + AES-GCM PII module) will swap in real decryption.
 */

export interface DashboardStats {
  leadsToday: number;
  leadsThisWeek: number;
  leadsThisMonth: number;
  hotLeads: number;
  wonLeads: number;
  estimatedRevenuePln: number;
}

export async function getDashboardStats(
  db: D1Database,
  clientId: string,
): Promise<DashboardStats> {
  const [today, week, month, hot, won, revenue] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM leads
          WHERE client_id = ? AND date(created_at) = date('now') AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM leads
          WHERE client_id = ? AND created_at >= datetime('now','-7 days') AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM leads
          WHERE client_id = ? AND created_at >= datetime('now','-30 days') AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM leads
          WHERE client_id = ? AND is_hot = 1 AND status NOT IN ('spam','duplicate') AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM leads
          WHERE client_id = ? AND status = 'won' AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(estimated_value_pln),0) AS s FROM leads
          WHERE client_id = ? AND status = 'won' AND deleted_at IS NULL`,
      )
      .bind(clientId)
      .first<{ s: number }>(),
  ]);

  return {
    leadsToday: today?.c ?? 0,
    leadsThisWeek: week?.c ?? 0,
    leadsThisMonth: month?.c ?? 0,
    hotLeads: hot?.c ?? 0,
    wonLeads: won?.c ?? 0,
    estimatedRevenuePln: revenue?.s ?? 0,
  };
}

export interface PanelLead {
  id: string;
  source: string;
  source_page: string | null;
  service_interest: string | null;
  estimated_value_pln: number | null;
  email_hash: string | null;
  phone_hash: string | null;
  status: string;
  is_hot: number;
  created_at: string;
  forwarded_status: string | null;
  consent_marketing: number;
}

export async function listLeads(
  db: D1Database,
  clientId: string,
  options: { limit?: number; status?: string } = {},
): Promise<PanelLead[]> {
  const limit = options.limit ?? 100;
  let sql = `SELECT id, source, source_page, service_interest, estimated_value_pln,
                    email_hash, phone_hash, status, is_hot, created_at,
                    forwarded_status, consent_marketing
               FROM leads
              WHERE client_id = ? AND deleted_at IS NULL`;
  const binds: unknown[] = [clientId];
  if (options.status) {
    sql += " AND status = ?";
    binds.push(options.status);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  binds.push(limit);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db.prepare(sql).bind(...binds) as any).all();
  return (result?.results ?? []) as PanelLead[];
}

export interface ClientFullConfig {
  id: string;
  business_name: string;
  legal_name: string | null;
  nip: string | null;
  industry: string;
  city: string;
  postal_code: string | null;
  voivodeship: string | null;
  primary_domain: string | null;
  preview_domain: string | null;
  tier: string;
  status: string;
  theme_preset: string;
  has_lock_in: number;
  lock_in_until: string | null;
  activated_at: string | null;
}

export async function getClientFullConfig(
  db: D1Database,
  clientId: string,
): Promise<ClientFullConfig | null> {
  return await db
    .prepare(
      `SELECT id, business_name, legal_name, nip, industry, city, postal_code, voivodeship,
              primary_domain, preview_domain, tier, status, theme_preset, has_lock_in, lock_in_until, activated_at
         FROM clients WHERE id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<ClientFullConfig>();
}

export interface ClientContact {
  contact_name: string;
  contact_email_hash: string;
  contact_phone_hash: string | null;
}

export async function getClientContact(
  db: D1Database,
  clientId: string,
): Promise<ClientContact | null> {
  return await db
    .prepare(
      `SELECT contact_name, contact_email_hash, contact_phone_hash
         FROM client_contacts WHERE client_id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<ClientContact>();
}

/** RODO: list lead consent records (sample from leads). */
export interface ConsentSummary {
  total_leads: number;
  consent_marketing_count: number;
  consent_processing_count: number;
  oldest_lead: string | null;
  retention_default_days: number;
}

export async function getConsentSummary(
  db: D1Database,
  clientId: string,
): Promise<ConsentSummary> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(consent_marketing) AS marketing,
         SUM(consent_processing) AS processing,
         MIN(created_at) AS oldest
       FROM leads WHERE client_id = ? AND deleted_at IS NULL`,
    )
    .bind(clientId)
    .first<{ total: number; marketing: number; processing: number; oldest: string | null }>();
  return {
    total_leads: row?.total ?? 0,
    consent_marketing_count: row?.marketing ?? 0,
    consent_processing_count: row?.processing ?? 0,
    oldest_lead: row?.oldest ?? null,
    retention_default_days: 24 * 30,
  };
}
