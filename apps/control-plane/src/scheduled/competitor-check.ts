/**
 * Track 24f-3 — Monitoring konkurencji weekly cron.
 *
 * For each klient with active `competitor_monitoring` addon:
 *   1. Read config (3 competitor domains + up to 10 keywords + location)
 *   2. For each keyword: DataForSEO Live SERP query
 *   3. Find rank for klient's own primary_domain + each competitor
 *   4. Insert competitor_snapshots rows
 *   5. Send weekly email summary
 *
 * Budget guard: max 10 keywords × N klients × ~$0.0006 = ~$0.024 per klient/week.
 * Cap at 50 klients per run to keep CPU under 30s Worker limit (DataForSEO live is ~3-5s/query).
 */

import type { Logger } from "@mixturemarketing/logger";

import type { Env } from "../env.js";
import { fetchSerpLive, findDomainPosition } from "../integrations/dataforseo.js";

interface ConfigRow {
  client_id: string;
  business_name: string;
  primary_domain: string | null;
  contact_email_enc: string | null;
  competitor_domains_json: string;
  keywords_json: string;
  location_code: number | null;
  location_name: string | null;
  search_language: string;
}

interface SnapshotEntry {
  keyword: string;
  positions: Record<string, number | null>;
  cost_grosze: number;
  raw_top10: Array<{ position: number; domain: string; url: string; title: string }>;
}

const MAX_KLIENTS_PER_RUN = 50;
const MAX_KEYWORDS_PER_KLIENT = 10;
const DEFAULT_LOCATION_CODE = 1011419; // Warsaw, Masovian Voivodeship, Poland (DataForSEO city-level)

function isoWeekId(d = new Date()): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseJsonArray(s: string): string[] {
  try {
    const parsed = JSON.parse(s) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function competitorCheckWeekly(env: Env, log: Logger): Promise<{ processed: number; failed: number; queries: number; cost_grosze_total: number }> {
  if (!env.DATAFORSEO_LOGIN || !env.DATAFORSEO_PASSWORD) {
    log.warn("competitor_check.skip", { reason: "DataForSEO credentials missing" });
    return { processed: 0, failed: 0, queries: 0, cost_grosze_total: 0 };
  }

  // Find all klients with active competitor_monitoring addon + their config
  const rows = await env.DB
    .prepare(
      `SELECT c.id AS client_id, c.business_name, c.primary_domain,
              cc.contact_email_enc,
              cfg.competitor_domains_json, cfg.keywords_json,
              cfg.location_code, cfg.location_name, cfg.search_language
         FROM client_addons ca
         JOIN clients c ON c.id = ca.client_id
         JOIN competitor_monitoring_config cfg ON cfg.client_id = ca.client_id
         LEFT JOIN client_contacts cc ON cc.client_id = c.id
        WHERE ca.addon_slug = 'competitor_monitoring'
          AND ca.status IN ('trial', 'active')
        ORDER BY ca.activated_at ASC
        LIMIT ?`,
    )
    .bind(MAX_KLIENTS_PER_RUN)
    .all<ConfigRow>();

  const list = rows.results ?? [];
  if (list.length === 0) {
    log.info("competitor_check.no_clients");
    return { processed: 0, failed: 0, queries: 0, cost_grosze_total: 0 };
  }

  const weekId = isoWeekId();
  let processed = 0;
  let failed = 0;
  let queries = 0;
  let costTotalGrosze = 0;

  for (const row of list) {
    try {
      const keywords = parseJsonArray(row.keywords_json).slice(0, MAX_KEYWORDS_PER_KLIENT);
      const competitors = parseJsonArray(row.competitor_domains_json).slice(0, 3);
      if (keywords.length === 0 || !row.primary_domain) {
        log.info("competitor_check.skip_klient", { client_id: row.client_id, reason: "no keywords or domain" });
        continue;
      }

      const snapshots: SnapshotEntry[] = [];
      for (const keyword of keywords) {
        const serp = await fetchSerpLive(
          { login: env.DATAFORSEO_LOGIN, password: env.DATAFORSEO_PASSWORD },
          {
            keyword,
            location_code: row.location_code ?? DEFAULT_LOCATION_CODE,
            language_code: row.search_language ?? "pl",
            depth: 10,
          },
        );
        queries++;
        const costGrosze = Math.round(serp.cost_usd * 100 * 4); // ~PLN at $1=4 PLN
        costTotalGrosze += costGrosze;

        const positions: Record<string, number | null> = {};
        positions[row.primary_domain] = findDomainPosition(serp, row.primary_domain);
        for (const comp of competitors) {
          positions[comp] = findDomainPosition(serp, comp);
        }
        snapshots.push({
          keyword,
          positions,
          cost_grosze: costGrosze,
          raw_top10: serp.organic.map((o) => ({ position: o.position, domain: o.domain, url: o.url, title: o.title })),
        });
      }

      // Insert snapshots
      for (const snap of snapshots) {
        await env.DB
          .prepare(
            `INSERT INTO competitor_snapshots (client_id, week_id, keyword, positions_json, cost_grosze, raw_top10_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            row.client_id,
            weekId,
            snap.keyword,
            JSON.stringify(snap.positions),
            snap.cost_grosze,
            JSON.stringify(snap.raw_top10),
          )
          .run();
      }

      // Update config: last_run_at
      await env.DB
        .prepare(`UPDATE competitor_monitoring_config SET last_run_at = datetime('now') WHERE client_id = ?`)
        .bind(row.client_id)
        .run();

      // Send email summary
      const email = row.contact_email_enc?.startsWith("dev:")
        ? row.contact_email_enc.slice(4)
        : row.contact_email_enc;
      if (email && env.RESEND_API_KEY) {
        const sent = await sendCompetitorReportEmail(env, {
          to: email,
          businessName: row.business_name,
          ourDomain: row.primary_domain,
          competitors,
          weekId,
          snapshots,
        });
        if (sent) {
          await env.DB
            .prepare(`UPDATE competitor_monitoring_config SET last_email_sent_at = datetime('now') WHERE client_id = ?`)
            .bind(row.client_id)
            .run();
        }
      }

      processed++;
      log.info("competitor_check.klient_done", { client_id: row.client_id, queries: keywords.length, cost_grosze: snapshots.reduce((s, x) => s + x.cost_grosze, 0) });
    } catch (e) {
      failed++;
      log.error("competitor_check.klient_failed", e instanceof Error ? e : new Error(String(e)), { client_id: row.client_id });
    }
  }

  return { processed, failed, queries, cost_grosze_total: costTotalGrosze };
}

async function sendCompetitorReportEmail(
  env: Env,
  input: {
    to: string;
    businessName: string;
    ourDomain: string;
    competitors: string[];
    weekId: string;
    snapshots: SnapshotEntry[];
  },
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;

  // Build comparison table
  const rows = input.snapshots
    .map((s) => {
      const ourPos = s.positions[input.ourDomain];
      const cells: string[] = [
        `<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(s.keyword)}</td>`,
        `<td style="padding:8px 10px;text-align:center;border-bottom:1px solid #e2e8f0;${ourPos && ourPos <= 3 ? "background:#dcfce7;font-weight:700;" : ""}">${ourPos ?? "—"}</td>`,
      ];
      for (const comp of input.competitors) {
        const p = s.positions[comp];
        cells.push(`<td style="padding:8px 10px;text-align:center;color:#64748b;border-bottom:1px solid #e2e8f0;">${p ?? "—"}</td>`);
      }
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  const compHeaders = input.competitors.map((c) => `<th style="padding:8px 10px;background:#f1f5f9;font-size:0.85rem;">${escapeHtml(c)}</th>`).join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px;">
      <h1 style="color:#047857;margin:0 0 12px 0;">📊 Raport SEO — ${escapeHtml(input.businessName)}</h1>
      <p style="color:#475569;margin:0 0 18px 0;">Tydzień ${input.weekId}. Pozycje na Google dla Twoich słów kluczowych.</p>

      <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
        <thead>
          <tr>
            <th style="padding:8px 10px;text-align:left;background:#f1f5f9;">Słowo kluczowe</th>
            <th style="padding:8px 10px;background:#dcfce7;color:#047857;">Twoja pozycja</th>
            ${compHeaders}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin:20px 0 10px 0;color:#64748b;font-size:0.85rem;">
        Pozycje 1-3 (zielone) = top wyniki Google.
        "—" = poza top 10.
      </p>

      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#64748b;font-size:13px;">
        MixtureMarketing — dodatek Monitoring konkurencji 30 zł/mc.<br>
        Pytania? <a href="mailto:info@mixturemarketing.pl">info@mixturemarketing.pl</a>
      </p>
    </div>
  `;

  const text = `Raport SEO — ${input.businessName} (${input.weekId})

${input.snapshots.map((s) => {
    const ourPos = s.positions[input.ourDomain];
    const compStr = input.competitors.map((c) => `${c}: ${s.positions[c] ?? "—"}`).join(", ");
    return `${s.keyword}\n  Twoja pozycja: ${ourPos ?? "—"}\n  Konkurenci: ${compStr}`;
  }).join("\n\n")}
`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        to: input.to,
        subject: `📊 Raport SEO ${input.businessName} — tydzień ${input.weekId}`,
        html,
        text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
