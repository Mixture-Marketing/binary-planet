/**
 * Track 24f-4 — Newsletter campaign sender.
 *
 * Called from:
 *   - Admin endpoint POST /api/admin/newsletter/send/:id (manual send)
 *   - Cron monthly_reports (auto-send scheduled campaigns)
 *
 * For each confirmed subscriber (opt_out_at IS NULL, confirmed_at IS NOT NULL):
 *   - Send email via Resend (if channel='email' OR 'both')
 *   - Send SMS via SMSAPI (if channel='sms' OR 'both' AND phone present)
 *   - Insert newsletter_sends row per recipient
 *
 * Markdown body is rendered to HTML with naive converter (no external lib).
 * For richer templates use HTML in body_markdown — markdown is just a hint.
 */

import type { Env } from "../env.js";

interface SendResult {
  ok: boolean;
  campaign_id: string;
  recipients: number;
  delivered: number;
  failed: number;
  error?: string;
}

const MAX_RECIPIENTS_PER_RUN = 500; // safety cap (Worker CPU budget)

export async function sendCampaign(env: Env, campaignId: string): Promise<SendResult> {
  const campaign = await env.DB
    .prepare(
      `SELECT id, client_id, channel, subject, body_markdown, sms_body, status FROM newsletter_campaigns WHERE id = ? LIMIT 1`,
    )
    .bind(campaignId)
    .first<{
      id: string;
      client_id: string;
      channel: "email" | "sms" | "both";
      subject: string;
      body_markdown: string;
      sms_body: string | null;
      status: string;
    }>();
  if (!campaign) return { ok: false, campaign_id: campaignId, recipients: 0, delivered: 0, failed: 0, error: "Campaign not found" };
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { ok: false, campaign_id: campaignId, recipients: 0, delivered: 0, failed: 0, error: `Campaign already ${campaign.status}` };
  }

  const klient = await env.DB
    .prepare(`SELECT business_name, primary_domain FROM clients WHERE id = ? LIMIT 1`)
    .bind(campaign.client_id)
    .first<{ business_name: string; primary_domain: string | null }>();
  const businessName = klient?.business_name ?? "MixtureMarketing";
  const baseUrl = klient?.primary_domain ? `https://${klient.primary_domain}` : `https://mixturemarketing.pl`;

  // Mark sending
  await env.DB
    .prepare(`UPDATE newsletter_campaigns SET status = 'sending' WHERE id = ?`)
    .bind(campaignId)
    .run();

  // Fetch subscribers
  const subs = await env.DB
    .prepare(
      `SELECT id, email_enc, phone_enc FROM newsletter_subscribers
        WHERE client_id = ? AND confirmed_at IS NOT NULL AND opt_out_at IS NULL
        ORDER BY created_at ASC LIMIT ?`,
    )
    .bind(campaign.client_id, MAX_RECIPIENTS_PER_RUN)
    .all<{ id: string; email_enc: string; phone_enc: string | null }>();

  const recipients = subs.results ?? [];
  if (recipients.length === 0) {
    await env.DB
      .prepare(`UPDATE newsletter_campaigns SET status = 'sent', sent_at = datetime('now'), recipients_count = 0 WHERE id = ?`)
      .bind(campaignId)
      .run();
    return { ok: true, campaign_id: campaignId, recipients: 0, delivered: 0, failed: 0 };
  }

  const htmlBody = renderMarkdownToHtml(campaign.body_markdown);
  let delivered = 0;
  let failed = 0;

  for (const sub of recipients) {
    const email = sub.email_enc.startsWith("dev:") ? sub.email_enc.slice(4) : sub.email_enc;
    const phone = sub.phone_enc ? (sub.phone_enc.startsWith("dev:") ? sub.phone_enc.slice(4) : sub.phone_enc) : null;

    // Email send
    if ((campaign.channel === "email" || campaign.channel === "both") && env.RESEND_API_KEY && email) {
      const unsubUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${sub.id}`;
      const wrappedHtml = wrapEmailHtml(htmlBody, businessName, unsubUrl);
      const res = await sendResendEmail(env, {
        to: email,
        from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        subject: campaign.subject,
        html: wrappedHtml,
        unsubUrl,
      });
      await env.DB
        .prepare(
          `INSERT INTO newsletter_sends (campaign_id, subscriber_id, channel, status, external_id, error_message)
           VALUES (?, ?, 'email', ?, ?, ?)`,
        )
        .bind(campaignId, sub.id, res.ok ? "sent" : "failed", res.id ?? null, res.error ?? null)
        .run();
      if (res.ok) delivered++; else failed++;
    }

    // SMS send
    if ((campaign.channel === "sms" || campaign.channel === "both") && env.SMSAPI_TOKEN && phone && campaign.sms_body) {
      const res = await sendSmsApi(env, { to: phone, body: campaign.sms_body });
      await env.DB
        .prepare(
          `INSERT INTO newsletter_sends (campaign_id, subscriber_id, channel, status, external_id, error_message)
           VALUES (?, ?, 'sms', ?, ?, ?)`,
        )
        .bind(campaignId, sub.id, res.ok ? "sent" : "failed", res.id ?? null, res.error ?? null)
        .run();
      if (res.ok) delivered++; else failed++;
    }
  }

  await env.DB
    .prepare(
      `UPDATE newsletter_campaigns
          SET status = 'sent', sent_at = datetime('now'),
              recipients_count = ?, delivered_count = ?, failed_count = ?
        WHERE id = ?`,
    )
    .bind(recipients.length, delivered, failed, campaignId)
    .run();

  return {
    ok: true,
    campaign_id: campaignId,
    recipients: recipients.length,
    delivered,
    failed,
  };
}

async function sendResendEmail(
  env: Env,
  input: { to: string; from: string; subject: string; html: string; unsubUrl: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        headers: {
          "List-Unsubscribe": `<${input.unsubUrl}>, <mailto:info@mixturemarketing.pl?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    const json = (await res.json()) as { id?: string };
    return { ok: true, ...(json.id && { id: json.id }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function sendSmsApi(
  env: Env,
  input: { to: string; body: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  // SMSAPI.pl: POST to https://api.smsapi.pl/sms.do
  // Auth: Bearer <token>
  try {
    const params = new URLSearchParams({
      to: input.to,
      message: input.body.slice(0, 459),
      from: "MixtureMM",
      format: "json",
      encoding: "utf-8",
    });
    const res = await fetch(`https://api.smsapi.pl/sms.do?${params.toString()}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.SMSAPI_TOKEN}` },
    });
    if (!res.ok) return { ok: false, error: `SMSAPI ${res.status}` };
    const json = (await res.json()) as { list?: Array<{ id: string }>; error?: string };
    if (json.error) return { ok: false, error: json.error };
    return { ok: true, ...(json.list?.[0]?.id && { id: json.list[0].id }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

/** Minimal markdown → HTML. Supports: # H1, ## H2, ### H3, **bold**, *italic*, [link](url), paragraphs, lists. */
function renderMarkdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push("");
      continue;
    }
    if (line.startsWith("### ")) { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## "))  { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# "))   { if (inList) { out.push("</ul>"); inList = false; } out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function inline(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function wrapEmailHtml(body: string, businessName: string, unsubUrl: string): string {
  return `<!doctype html><html lang="pl"><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a;">
${body}
<hr style="border:0;border-top:1px solid #e2e8f0;margin:32px 0;">
<p style="color:#94a3b8;font-size:12px;text-align:center;">
${escapeHtml(businessName)}<br>
<a href="${unsubUrl}" style="color:#94a3b8;">Wypisz mnie z newslettera</a>
</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
