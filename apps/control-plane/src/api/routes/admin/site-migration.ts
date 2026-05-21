/**
 * Track 24f-9 — Site migration addon (299 zł 1×).
 *
 * Flow:
 *   1. Operator (lub klient via panel — TBD) POST /api/admin/site-migration/start
 *      Body: { client_id, source_url, max_pages? }
 *   2. Hub asynchronicznie skanuje sitemap → fetch każdej page → extract content
 *   3. Generuje JSON report w R2 (migrations/{client_id}/{run_id}.json)
 *   4. Email do klienta z linkiem do raportu + sugerowane 301 redirects
 *   5. (Faza 2) klient akceptuje → cron commituje content jako Markdown do klient repo
 *
 * Auth: X-BP-Admin-Key.
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { discoverUrls, scrapePage, type ScrapedPage } from "../../../lib/scraper.js";
import { err, ok } from "../../lib/responses.js";

export const adminSiteMigrationRouter = new Hono<HonoEnv>();

const MAX_PAGES_DEFAULT = 50;
const MAX_PAGES_CAP = 200;
const PARALLELISM = 4;

function checkAuth(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `mig_${hex}`;
}

adminSiteMigrationRouter.post("/start", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  let body: { client_id?: string; source_url?: string; max_pages?: number };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id || !body.source_url) {
    return c.json(err("VALIDATION_ERROR", "client_id + source_url required"), 400);
  }
  let sourceUrl: string;
  try { sourceUrl = new URL(body.source_url).origin; } catch {
    return c.json(err("VALIDATION_ERROR", "source_url invalid"), 422);
  }

  // Verify klient has active site_migration addon
  const addon = await c.env.DB
    .prepare(`SELECT id FROM client_addons WHERE client_id = ? AND addon_slug = 'site_migration' AND status IN ('trial','active') ORDER BY id DESC LIMIT 1`)
    .bind(body.client_id)
    .first<{ id: number }>();
  if (!addon) {
    return c.json(err("VALIDATION_ERROR", "Klient nie ma aktywnego dodatku site_migration"), 422);
  }

  const maxPages = Math.min(body.max_pages ?? MAX_PAGES_DEFAULT, MAX_PAGES_CAP);
  const runId = randomId();

  await c.env.DB
    .prepare(
      `INSERT INTO migration_runs (id, client_id, source_url, status, metadata_json)
       VALUES (?, ?, ?, 'running', ?)`,
    )
    .bind(runId, body.client_id, sourceUrl, JSON.stringify({ max_pages: maxPages }))
    .run();

  // Execute scan (synchronous — Worker has CPU budget, capped by maxPages * timeout)
  const log = c.get("logger");
  try {
    const result = await runMigrationScan(c.env, body.client_id, runId, sourceUrl, maxPages, log);
    return c.json(ok(result), 200);
  } catch (e) {
    await c.env.DB
      .prepare(`UPDATE migration_runs SET status='failed', finished_at=datetime('now'), error_message=? WHERE id=?`)
      .bind(e instanceof Error ? e.message : "unknown", runId)
      .run();
    return c.json(err("INTERNAL_ERROR", e instanceof Error ? e.message : "scan failed"), 500);
  }
});

adminSiteMigrationRouter.get("/status/:run_id", async (c) => {
  const authErr = checkAuth(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);
  const id = c.req.param("run_id");
  const row = await c.env.DB
    .prepare(`SELECT * FROM migration_runs WHERE id = ?`)
    .bind(id)
    .first();
  if (!row) return c.json(err("NOT_FOUND", "Run not found"), 404);
  return c.json(ok(row), 200);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runMigrationScan(env: import("../../../env.js").Env, clientId: string, runId: string, sourceUrl: string, maxPages: number, log: any) {
  // 1. Discover URLs
  const urls = await discoverUrls(sourceUrl, { maxUrls: maxPages });
  if (log) log.info("migration.urls_discovered", { run_id: runId, count: urls.length });

  await env.DB
    .prepare(`UPDATE migration_runs SET pages_found = ? WHERE id = ?`)
    .bind(urls.length, runId)
    .run();

  // 2. Scrape pages (limited parallelism)
  const pages: ScrapedPage[] = [];
  for (let i = 0; i < urls.length; i += PARALLELISM) {
    const batch = urls.slice(i, i + PARALLELISM);
    const results = await Promise.all(batch.map((url) => scrapePage(url, { baseUrl: sourceUrl })));
    pages.push(...results);
  }

  // 3. Build report
  const klient = await env.DB
    .prepare(`SELECT primary_domain, business_name FROM clients WHERE id = ? LIMIT 1`)
    .bind(clientId)
    .first<{ primary_domain: string | null; business_name: string }>();

  const report = {
    metadata: {
      run_id: runId,
      client_id: clientId,
      source_url: sourceUrl,
      target_domain: klient?.primary_domain ?? "(brak — strona nie wdrożona)",
      taken_at: new Date().toISOString(),
      pages_found: urls.length,
      pages_scraped_ok: pages.filter((p) => !p.error).length,
      pages_scraped_failed: pages.filter((p) => p.error).length,
      total_word_count: pages.reduce((s, p) => s + p.word_count, 0),
    },
    pages: pages.map((p) => ({
      source_url: p.url,
      target_url: klient?.primary_domain ? p.url.replace(sourceUrl, `https://${klient.primary_domain}`) : null,
      status: p.status,
      title: p.title,
      description: p.description,
      h1: p.h1,
      body_text_preview: p.bodyText?.slice(0, 500),
      word_count: p.word_count,
      error: p.error,
    })),
    redirects_proposed: klient?.primary_domain
      ? pages
          .filter((p) => !p.error && p.url !== sourceUrl)
          .map((p) => {
            const path = p.url.replace(sourceUrl, "");
            return { from: path, to: path, status: 301 };
          })
      : [],
  };

  // 4. Save report to R2
  const reportKey = `migrations/${clientId}/${runId}.json`;
  await env.BACKUPS.put(reportKey, JSON.stringify(report, null, 2), {
    httpMetadata: { contentType: "application/json" },
    customMetadata: {
      client_id: clientId,
      run_id: runId,
      pages: String(report.metadata.pages_scraped_ok),
    },
  });

  await env.DB
    .prepare(
      `UPDATE migration_runs
          SET status = 'done', finished_at = datetime('now'),
              pages_scraped = ?, report_r2_key = ?
        WHERE id = ?`,
    )
    .bind(report.metadata.pages_scraped_ok, reportKey, runId)
    .run();

  // 5. Email klient z linkiem do raportu
  const contact = await env.DB
    .prepare(`SELECT contact_email_enc FROM client_contacts WHERE client_id = ? LIMIT 1`)
    .bind(clientId)
    .first<{ contact_email_enc: string | null }>();
  const email = contact?.contact_email_enc?.startsWith("dev:")
    ? contact.contact_email_enc.slice(4)
    : contact?.contact_email_enc;
  if (email && env.RESEND_API_KEY) {
    const reportUrl = `https://api.mixturemarketing.pl/api/admin/backup/get?key=${encodeURIComponent(reportKey)}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        to: email,
        subject: `Migracja strony ${klient?.business_name ?? ""} — raport gotowy`,
        html: `<p>Cześć,</p><p>Zakończyliśmy skanowanie Twojej obecnej strony <strong>${escapeHtml(sourceUrl)}</strong>.</p>
<ul>
  <li>Znalezionych URLi: <strong>${report.metadata.pages_found}</strong></li>
  <li>Zeskanowanych z sukcesem: <strong>${report.metadata.pages_scraped_ok}</strong></li>
  <li>Łączna liczba słów: <strong>${report.metadata.total_word_count.toLocaleString("pl-PL")}</strong></li>
</ul>
<p>Pełny raport JSON dostępny dla operatora pod kluczem R2: <code>${reportKey}</code>.</p>
<p>W ciągu 48h operator dokona przeglądu raportu i zaproponuje plan migracji (mapowanie podstron + 301 redirects).</p>
<p style="color:#64748b;font-size:13px;">Pytania? Odpisz na ten mail.</p>`,
        text: `Migracja strony ${klient?.business_name ?? ""} — raport gotowy.\nZnalezionych URLi: ${report.metadata.pages_found}\nZeskanowano: ${report.metadata.pages_scraped_ok}\nReport: ${reportKey}`,
      }),
    }).catch(() => { /* swallow */ });
  }

  // 6. Audit
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system', 'migration.scan_completed', 'migration_run', ?, ?, 'info', ?)`,
    )
    .bind(runId, clientId, JSON.stringify(report.metadata))
    .run();

  return {
    run_id: runId,
    status: "done",
    pages_found: report.metadata.pages_found,
    pages_scraped: report.metadata.pages_scraped_ok,
    report_key: reportKey,
    email_sent: !!email,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
