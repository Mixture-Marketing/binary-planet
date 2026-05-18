/**
 * Leads table data access.
 * Receives validated TransportLead from spoke → POST /api/leads.
 */

import type { TransportLead } from "@mixturemarketing/web-core/forms";

import { newId } from "../api/lib/ids.js";

export interface LeadInsertResult {
  /** Hub-side ID assigned during insert. */
  hubLeadId: string;
  /** True if a row with same (client_id, client_lead_id) already existed — dedup'd, not inserted. */
  duplicate: boolean;
}

/**
 * Insert TransportLead. Idempotent: if (client_id, client_lead_id) already inserted,
 * returns the existing hubLeadId without duplicate-inserting.
 *
 * This is the gate against spoke retries / fallback queue drain re-running the same lead.
 */
export async function insertLead(
  db: D1Database,
  lead: TransportLead,
  authenticatedClientId: string,
): Promise<LeadInsertResult> {
  // Safety: spoke's lead.client_id must match the authenticated klient.
  if (lead.client_id !== authenticatedClientId) {
    throw new Error(
      `client_id mismatch: lead.client_id=${lead.client_id} auth=${authenticatedClientId}`,
    );
  }

  // Check for existing row by (client_id, client_lead_id) — natural dedup key
  const existing = await db
    .prepare(
      `SELECT id FROM leads
        WHERE client_id = ? AND id = ?
        LIMIT 1`,
    )
    .bind(lead.client_id, lead.client_lead_id)
    .first<{ id: string }>();

  if (existing) {
    return { hubLeadId: existing.id, duplicate: true };
  }

  // Use spoke-generated client_lead_id as the row id — keeps it traceable end-to-end.
  // (Hub doesn't need to mint its own — spoke's is already random + prefixed.)
  const hubLeadId = lead.client_lead_id || newId("lead");

  // delete_after omitted from INSERT — schema DEFAULT (date('now', '+24 months')) fires only
  // when column is unspecified (binding NULL would either violate NOT NULL or skip DEFAULT).
  await db
    .prepare(
      `INSERT INTO leads (
         id, client_id, source, source_page, utm_source, utm_medium, utm_campaign,
         visitor_id_hash, user_agent_family, country_code, city,
         name_enc, email_enc, email_hash, phone_enc, phone_hash, message_enc,
         service_interest, estimated_value_pln,
         consent_processing, consent_marketing, consent_text_version,
         consent_ip_hash, consent_at,
         created_at
       ) VALUES (
         ?, ?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?,
         ?, ?,
         ?
       )`,
    )
    .bind(
      hubLeadId,
      lead.client_id,
      lead.source,
      lead.source_page ?? null,
      lead.utm_source ?? null,
      lead.utm_medium ?? null,
      lead.utm_campaign ?? null,
      lead.visitor_id_hash ?? null,
      lead.user_agent_family ?? null,
      lead.country_code ?? null,
      lead.city ?? null,
      lead.name_enc ?? null,
      lead.email_enc ?? null,
      lead.email_hash,
      lead.phone_enc ?? null,
      lead.phone_hash ?? null,
      lead.message_enc ?? null,
      lead.service_interest ?? null,
      lead.estimated_value_pln ?? null,
      lead.consent_processing,
      lead.consent_marketing,
      lead.consent_text_version,
      lead.consent_ip_hash ?? null,
      lead.consent_at,
      lead.spoke_received_at,
    )
    .run();

  return { hubLeadId, duplicate: false };
}

export interface LeadCountByDay {
  day: string;
  count: number;
}

export async function leadsLastNDaysByClient(
  db: D1Database,
  clientId: string,
  days: number,
): Promise<LeadCountByDay[]> {
  const result = await db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM leads
        WHERE client_id = ?
          AND created_at >= datetime('now', ?)
          AND status NOT IN ('spam', 'duplicate')
        GROUP BY date(created_at)
        ORDER BY day ASC`,
    )
    .bind(clientId, `-${days} days`)
    .all<LeadCountByDay>();
  return result.results ?? [];
}
