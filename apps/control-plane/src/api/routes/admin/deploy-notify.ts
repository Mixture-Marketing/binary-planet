/**
 * POST /api/admin/deploy-notify — called by klient repo's GH Actions workflow
 * at end of successful deploy (klient-deploy.yml "Notify hub" step).
 *
 * Effect:
 *   1. Find client by cf_worker_name (set during provision-client.ts step 5)
 *   2. Send "Twoja strona jest gotowa" email via Resend with 3 links:
 *      - Frontend URL (workers.dev preview or custom domain)
 *      - /admin/ Sveltia CMS
 *      - panel.mixturemarketing.pl klient panel
 *   3. Audit log
 *   4. Idempotent: re-deploys don't re-send email (audit_log dedup)
 *
 * Auth: X-BP-Admin-Key (same as cron/run-now).
 *
 * Body: { worker_name: string, status: "deployed"|"failed", commit: string }
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { err, ok } from "../../lib/responses.js";

export const deployNotifyRouter = new Hono<HonoEnv>();

const TEST_SUBDOMAIN_FALLBACK = "workers.dev";

deployNotifyRouter.post("/", async (c) => {
  const env = c.env;
  const expected = env.ADMIN_API_KEY;
  if (!expected) return c.json(err("AUTH_MISSING_KEY", "Deploy-notify disabled"), 403);
  if (c.req.header("X-BP-Admin-Key") !== expected) {
    return c.json(err("AUTH_INVALID_KEY", "Invalid X-BP-Admin-Key"), 401);
  }

  let body: { worker_name?: string; status?: string; commit?: string };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }

  const workerName = body.worker_name?.trim();
  if (!workerName) return c.json(err("VALIDATION_ERROR", "worker_name required"), 400);
  if (body.status !== "deployed") {
    // Workflow only calls us on success, but be defensive
    return c.json(ok({ skipped: true, reason: `status=${body.status ?? "unknown"}` }), 200);
  }

  // Find client by worker_name + load email
  const row = await env.DB
    .prepare(
      `SELECT c.id, c.business_name, c.primary_domain, c.activated_at,
              cc.contact_email_enc
         FROM clients c
         LEFT JOIN client_contacts cc ON cc.client_id = c.id
        WHERE c.cf_worker_name = ?
        LIMIT 1`,
    )
    .bind(workerName)
    .first<{
      id: string;
      business_name: string;
      primary_domain: string | null;
      activated_at: string | null;
      contact_email_enc: string | null;
    }>();

  if (!row) {
    return c.json(err("NOT_FOUND", `No client found for worker_name=${workerName}`), 404);
  }

  // Idempotency: if we've already sent the deploy email, skip
  const already = await env.DB
    .prepare(
      `SELECT id FROM audit_log
        WHERE client_id = ? AND action = 'deploy.email_sent'
        LIMIT 1`,
    )
    .bind(row.id)
    .first<{ id: string }>();

  if (already) {
    return c.json(ok({ skipped: true, reason: "already sent" }), 200);
  }

  const email = row.contact_email_enc?.startsWith("dev:")
    ? row.contact_email_enc.slice(4)
    : row.contact_email_enc;
  if (!email) {
    return c.json(err("NOT_FOUND", "Klient has no email on file"), 422);
  }

  // Resolve URLs
  const subdomain = env.CF_WORKERS_DEV_SUBDOMAIN ?? TEST_SUBDOMAIN_FALLBACK;
  const isTestMode = (env.PROVISIONING_TEST_MODE ?? "").toLowerCase() === "true";
  const siteUrl = isTestMode
    ? `https://${workerName}.${subdomain}.workers.dev`
    : row.primary_domain
      ? `https://${row.primary_domain}`
      : `https://${workerName}.${subdomain}.workers.dev`;
  const adminUrl = `${siteUrl}/admin/`;
  const panelUrl = "https://panel.mixturemarketing.pl/";

  // Send email
  const sendResult = await sendDeployedEmail(env, {
    to: email,
    businessName: row.business_name,
    siteUrl,
    adminUrl,
    panelUrl,
    isTestMode,
  });

  // Audit log (mark email sent + record commit)
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system', 'deploy.email_sent', 'client', ?, ?, 'info', ?)`,
    )
    .bind(
      row.id,
      row.id,
      JSON.stringify({
        worker_name: workerName,
        commit: body.commit,
        site_url: siteUrl,
        email_sent: sendResult.ok,
        ...(sendResult.error && { send_error: sendResult.error }),
      }),
    )
    .run();

  // Bump activated_at if not yet set
  if (!row.activated_at) {
    await env.DB
      .prepare(`UPDATE clients SET activated_at = datetime('now') WHERE id = ? AND activated_at IS NULL`)
      .bind(row.id)
      .run();
  }

  return c.json(
    ok({
      client_id: row.id,
      site_url: siteUrl,
      email_sent: sendResult.ok,
      ...(sendResult.error && { send_error: sendResult.error }),
    }),
    200,
  );
});

async function sendDeployedEmail(
  env: import("../../../env.js").Env,
  input: {
    to: string;
    businessName: string;
    siteUrl: string;
    adminUrl: string;
    panelUrl: string;
    isTestMode: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[deploy-notify] Resend not configured; would email ${input.to}: site=${input.siteUrl}`);
    return { ok: false, error: "Resend not configured" };
  }

  const testBadge = input.isTestMode
    ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:0 0 24px 0;border-radius:6px;color:#78350f;font-size:14px;"><strong>Tryb testowy</strong> — strona działa na technicznej domenie Cloudflare. Po przejściu na produkcję Twoja strona będzie dostępna pod docelową domeną.</div>`
    : "";

  const subject = `🎉 Twoja strona jest gotowa — ${input.businessName}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="color: #047857; margin: 0 0 16px 0;">Twoja strona jest gotowa! 🎉</h1>
      ${testBadge}
      <p>Cześć,</p>
      <p>Skończyliśmy budować stronę <strong>${escapeHtml(input.businessName)}</strong>. Wszystkie dane z wizardu są na miejscu — możesz już ją odwiedzić i pokazać klientom.</p>

      <div style="margin: 24px 0; padding: 20px; background: #f1f5f9; border-radius: 12px;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #0f172a;">🌐 Twoja strona</p>
        <p style="margin: 0 0 16px 0;">
          <a href="${input.siteUrl}" style="color:#047857; word-break: break-all;">${escapeHtml(input.siteUrl)}</a>
        </p>

        <p style="margin: 16px 0 8px 0; font-weight: 600; color: #0f172a;">✏️ Edycja treści (CMS)</p>
        <p style="margin: 0 0 8px 0;">
          <a href="${input.adminUrl}" style="color:#047857;">${escapeHtml(input.adminUrl)}</a>
        </p>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
          Logowanie przez Twoje konto GitHub. Dodawaj posty, FAQ, zdjęcia w galerii — zmiany pojawiają się na stronie w ciągu kilku minut.
        </p>

        <p style="margin: 16px 0 8px 0; font-weight: 600; color: #0f172a;">⚙️ Panel klienta</p>
        <p style="margin: 0 0 8px 0;">
          <a href="${input.panelUrl}" style="color:#047857;">${escapeHtml(input.panelUrl)}</a>
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          Faktury, dane firmy, kontakt z nami. Logowanie magic-link na ten adres email.
        </p>
      </div>

      <h2 style="font-size: 16px; margin: 24px 0 8px 0;">Co dalej?</h2>
      <ol style="line-height: 1.7; padding-left: 20px;">
        <li>Sprawdź czy wszystkie dane na stronie się zgadzają (telefon, adres, godziny otwarcia)</li>
        <li>Dodaj pierwszy post lub zdjęcia w galerii przez CMS</li>
        <li>Daj nam znać jeśli coś chcesz zmienić — odpowiedz na tego maila</li>
      </ol>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;">
      <p style="color:#64748b; font-size: 13px;">
        Pytania? Odpowiedz na tego maila albo napisz na
        <a href="mailto:info@mixturemarketing.pl">info@mixturemarketing.pl</a>.<br>
        MixtureMarketing — strony www + lokalne SEO dla mikrofirm 🇵🇱
      </p>
    </div>
  `;
  const text = `Twoja strona jest gotowa!

Firma: ${input.businessName}
${input.isTestMode ? "[TRYB TESTOWY — strona na technicznej domenie Cloudflare]\n\n" : ""}
Strona:        ${input.siteUrl}
Edycja CMS:    ${input.adminUrl}
Panel klienta: ${input.panelUrl}

Co dalej:
1. Sprawdź dane firmy na stronie
2. Dodaj pierwszy post / zdjęcie w CMS
3. Daj znać co chcesz zmienić — odpowiedz na tego maila

Pytania: info@mixturemarketing.pl
`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        to: input.to,
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
