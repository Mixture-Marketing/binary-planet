/**
 * Track 22 — Lifecycle hooks (churn / reactivate).
 *
 * Triggered by stripe webhooks:
 *   - customer.subscription.deleted → executeChurnPipeline()
 *   - preonboard.ts when existing churned client returns → executeReactivatePipeline()
 *
 * Best-effort: each step has independent try/catch. We don't want one failure
 * (e.g. CF API rate limit) to block the whole churn cleanup.
 */

import type { Env } from "../env.js";

interface ChurnPipelineResult {
  client_id: string;
  steps: Array<{ step: string; ok: boolean; message: string }>;
  email_sent: boolean;
}

/**
 * Full churn pipeline for a client:
 *   1. Archive GH klient repo
 *   2. Detach custom domain (if attached)
 *   3. Cancel all active client_addons (so Stripe doesn't keep billing addons)
 *   4. Send "strona zarchiwizowana + winback offer" email
 *   5. Insert P3 alert for operator awareness
 *   6. Audit log
 */
export async function executeChurnPipeline(env: Env, clientId: string): Promise<ChurnPipelineResult> {
  const steps: ChurnPipelineResult["steps"] = [];
  let emailSent = false;

  const client = await env.DB
    .prepare(
      `SELECT c.business_name, c.primary_domain, c.cf_worker_name, c.github_repo_url,
              cc.contact_email_enc
         FROM clients c LEFT JOIN client_contacts cc ON cc.client_id = c.id
        WHERE c.id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<{ business_name: string; primary_domain: string | null; cf_worker_name: string | null; github_repo_url: string | null; contact_email_enc: string | null }>();
  if (!client) {
    return { client_id: clientId, steps: [{ step: "lookup", ok: false, message: "Client not found" }], email_sent: false };
  }

  // 1. Archive GH repo
  if (client.github_repo_url && env.GITHUB_PAT) {
    const match = client.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      try {
        const res = await fetch(`https://api.github.com/repos/${match[1]}/${match[2]}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${env.GITHUB_PAT}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "mm-control-plane",
          },
          body: JSON.stringify({ archived: true }),
        });
        steps.push({ step: "gh_archive_repo", ok: res.ok, message: res.ok ? "Repo archived" : `GH ${res.status}` });
      } catch (e) {
        steps.push({ step: "gh_archive_repo", ok: false, message: e instanceof Error ? e.message : "fetch failed" });
      }
    }
  }

  // 2. Detach custom domain (best-effort — won't fail if no domain attached)
  if (client.primary_domain && client.cf_worker_name && env.CF_API_TOKEN && env.CF_ACCOUNT_ID) {
    try {
      // Find domain attachment
      const listRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains?service=${client.cf_worker_name}`,
        { headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}` } },
      );
      if (listRes.ok) {
        const list = (await listRes.json()) as { result?: Array<{ id: string; hostname: string }> };
        for (const d of list.result ?? []) {
          await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/domains/${d.id}`,
            { method: "DELETE", headers: { "Authorization": `Bearer ${env.CF_API_TOKEN}` } },
          );
        }
        steps.push({ step: "cf_detach_domain", ok: true, message: `Detached ${list.result?.length ?? 0} domain(s)` });
      }
    } catch (e) {
      steps.push({ step: "cf_detach_domain", ok: false, message: e instanceof Error ? e.message : "unknown" });
    }
  }

  // 3. Cancel all active addons (Stripe sub already canceled by webhook caller — just D1 cleanup)
  const addonRes = await env.DB
    .prepare(
      `UPDATE client_addons
          SET status = 'canceled', canceled_at = datetime('now'), cancel_reason = 'churn'
        WHERE client_id = ? AND status IN ('trial', 'active')`,
    )
    .bind(clientId)
    .run();
  steps.push({
    step: "cancel_addons",
    ok: true,
    message: `Canceled ${addonRes.meta?.changes ?? 0} addon(s)`,
  });

  // 4. Send winback email
  const email = client.contact_email_enc?.startsWith("dev:")
    ? client.contact_email_enc.slice(4)
    : client.contact_email_enc;
  if (email && env.RESEND_API_KEY) {
    const sent = await sendChurnWinbackEmail(env, {
      to: email,
      businessName: client.business_name,
      primaryDomain: client.primary_domain,
    });
    emailSent = sent;
    steps.push({ step: "winback_email", ok: sent, message: sent ? "Sent" : "Send failed" });
  }

  // 5. P3 alert (operator awareness)
  await env.DB
    .prepare(
      `INSERT INTO alerts (severity, alert_type, client_id, resource_type, resource_id, title, description, status, fired_at, dedup_key, dedup_count)
       VALUES ('P3','client_churned',?,'client',?,?,?,'open',datetime('now'),?,1)`,
    )
    .bind(
      clientId,
      clientId,
      `Klient zrezygnował: ${client.business_name}`,
      `Klient ${clientId} (${client.business_name}) — Stripe subscription canceled. Repo zarchiwizowane, domena odpięta, addons wyłączone. Winback email: ${emailSent ? "wysłany" : "BRAK"}.`,
      `churn:${clientId}`,
    )
    .run();
  steps.push({ step: "alert_p3", ok: true, message: "P3 alert created" });

  // 6. Audit log
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system','client.churn_pipeline','client',?,?,'warn',?)`,
    )
    .bind(clientId, clientId, JSON.stringify({ steps_count: steps.length, email_sent: emailSent }))
    .run();

  return { client_id: clientId, steps, email_sent: emailSent };
}

/**
 * Reactivation pipeline — called when a churned client subscribes again.
 *   1. Un-archive GH repo
 *   2. Reset clients.status = 'provisioning' (cron will re-deploy)
 *   3. Clear churned_at, set activated_at
 *   4. Send "witamy z powrotem" email
 *   5. Audit log
 */
export async function executeReactivatePipeline(env: Env, clientId: string): Promise<{ ok: boolean; steps: Array<{ step: string; ok: boolean; message: string }> }> {
  const steps: Array<{ step: string; ok: boolean; message: string }> = [];

  const client = await env.DB
    .prepare(
      `SELECT business_name, github_repo_url, cf_worker_name
         FROM clients WHERE id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<{ business_name: string; github_repo_url: string | null; cf_worker_name: string | null }>();
  if (!client) return { ok: false, steps: [{ step: "lookup", ok: false, message: "Client not found" }] };

  // 1. Un-archive GH repo
  if (client.github_repo_url && env.GITHUB_PAT) {
    const match = client.github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      try {
        const res = await fetch(`https://api.github.com/repos/${match[1]}/${match[2]}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${env.GITHUB_PAT}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "mm-control-plane",
          },
          body: JSON.stringify({ archived: false }),
        });
        steps.push({ step: "gh_unarchive_repo", ok: res.ok, message: res.ok ? "Repo un-archived" : `GH ${res.status}` });
      } catch (e) {
        steps.push({ step: "gh_unarchive_repo", ok: false, message: e instanceof Error ? e.message : "fetch failed" });
      }
    }
  }

  // 2. Reset status (cron pipeline will pick up + redeploy)
  await env.DB
    .prepare(
      `UPDATE clients SET status = 'provisioning', activated_at = datetime('now'), churned_at = NULL WHERE id = ?`,
    )
    .bind(clientId)
    .run();
  steps.push({ step: "reset_status", ok: true, message: "Status: churned → provisioning" });

  // 3. Audit log
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system','client.reactivated','client',?,?,'info',?)`,
    )
    .bind(clientId, clientId, JSON.stringify({ business_name: client.business_name }))
    .run();
  steps.push({ step: "audit_log", ok: true, message: "Logged" });

  return { ok: true, steps };
}

// Tier rank — lower = cheaper. Used for downgrade detection.
const TIER_RANK: Record<string, number> = { starter: 1, standard: 2, premium: 3, professional: 4 };

/**
 * Addons that should be auto-canceled when downgrading from a higher tier.
 * E.g. Blog AI is "included" in Premium — if klient downgrades to Standard,
 * we cancel the implicit blog_ai addon (klient would pay for it separately).
 *
 * For now: only audit, don't auto-cancel addons (klient might still want them paid).
 * Real downgrade logic = email klient "Twoje dodatki nadal aktywne, jeśli chcesz wyłączyć — panel."
 */
export async function enforceTierDowngrade(
  env: Env,
  clientId: string,
  fromTier: string,
  toTier: string,
): Promise<{ ok: boolean; addons_affected: number; email_sent: boolean }> {
  const fromRank = TIER_RANK[fromTier] ?? 0;
  const toRank = TIER_RANK[toTier] ?? 0;
  if (toRank >= fromRank) {
    // Upgrade or same — no action needed
    return { ok: true, addons_affected: 0, email_sent: false };
  }

  // Audit
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES ('system', 'client.tier_downgrade', 'client', ?, ?, 'warn', ?)`,
    )
    .bind(clientId, clientId, JSON.stringify({ from: fromTier, to: toTier }))
    .run();

  // Count active addons (informational, not auto-cancel)
  const addons = await env.DB
    .prepare(`SELECT COUNT(*) AS n FROM client_addons WHERE client_id = ? AND status IN ('trial','active')`)
    .bind(clientId)
    .first<{ n: number }>();

  // Send notification email
  const klient = await env.DB
    .prepare(
      `SELECT c.business_name, cc.contact_email_enc
         FROM clients c LEFT JOIN client_contacts cc ON cc.client_id = c.id
        WHERE c.id = ? LIMIT 1`,
    )
    .bind(clientId)
    .first<{ business_name: string; contact_email_enc: string | null }>();

  let emailSent = false;
  const email = klient?.contact_email_enc?.startsWith("dev:") ? klient.contact_email_enc.slice(4) : klient?.contact_email_enc;
  if (email && env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
          to: email,
          subject: `Zmiana pakietu: ${fromTier} → ${toTier}`,
          html: `<p>Cześć,</p><p>Zmieniłeś pakiet z <strong>${fromTier}</strong> na <strong>${toTier}</strong>.</p>
<p>Twoje aktywne dodatki (${addons?.n ?? 0}) <strong>pozostają włączone</strong> — naliczamy je osobno. Jeśli chcesz coś wyłączyć, zaloguj się do panelu i kliknij "Wyłącz" przy wybranym dodatku.</p>
<p><a href="https://panel.mixturemarketing.pl/addons" style="display:inline-block;background:#047857;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Zarządzaj dodatkami →</a></p>
<p style="color:#64748b;font-size:13px;">Pytania? Odpisz na ten mail.</p>`,
          text: `Zmiana pakietu ${fromTier} → ${toTier}. Twoje ${addons?.n ?? 0} dodatków pozostaje aktywnych. Zarządzaj: panel.mixturemarketing.pl/addons`,
        }),
      });
      emailSent = res.ok;
    } catch { /* swallow */ }
  }

  return { ok: true, addons_affected: addons?.n ?? 0, email_sent: emailSent };
}

async function sendChurnWinbackEmail(
  env: Env,
  input: { to: string; businessName: string; primaryDomain: string | null },
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;padding:24px;">
      <h1 style="color:#0f172a;margin:0 0 16px 0;">Twoja strona została zarchiwizowana</h1>
      <p>Cześć,</p>
      <p>Otrzymaliśmy informację o zakończeniu Twojej subskrypcji. <strong>${escapeHtml(input.businessName)}</strong>${input.primaryDomain ? ` (${escapeHtml(input.primaryDomain)})` : ""} została wyłączona, ale wszystkie Twoje dane są bezpiecznie zarchiwizowane.</p>

      <div style="margin:24px 0;padding:20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;">
        <p style="margin:0;font-weight:700;color:#78350f;">🎁 Oferta powrotu</p>
        <p style="margin:6px 0 0 0;color:#78350f;">Jeśli zdecydujesz się wrócić w ciągu 90 dni — pierwszy miesiąc <strong>-30% rabatu</strong>. Twoja strona, dane, treści wracają w 24h.</p>
      </div>

      <p>Wystarczy odpowiedzieć na tego maila lub napisać na <a href="mailto:info@mixturemarketing.pl">info@mixturemarketing.pl</a>.</p>

      <p style="margin-top:24px;">Dziękujemy za współpracę. Życzymy powodzenia 🙏</p>

      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#64748b;font-size:13px;">
        MixtureMarketing<br>
        Pytania? <a href="mailto:info@mixturemarketing.pl">info@mixturemarketing.pl</a>
      </p>
    </div>
  `;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        to: input.to,
        subject: `${input.businessName} — Twoja strona została zarchiwizowana`,
        html,
        text: `Twoja strona ${input.businessName} została zarchiwizowana. Oferta powrotu: -30% przez pierwszy miesiąc, ważna 90 dni. Pisz: info@mixturemarketing.pl`,
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
