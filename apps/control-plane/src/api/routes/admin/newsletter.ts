/**
 * Track 24f-4 — Newsletter + SMS Automation addon endpoints.
 *
 * Public-ish endpoints (auth: X-BP-Client-Key + client_id in body, OR X-BP-Admin-Key):
 *   POST /api/admin/newsletter/subscribe   — klient site → hub (subscriber signup)
 *   GET  /api/admin/newsletter/confirm     — public, klient klika w link z mailem (no auth)
 *   GET  /api/admin/newsletter/unsubscribe — public, klient klika "unsubscribe" w mailu
 *   POST /api/admin/newsletter/campaign    — operator tworzy campaign (admin auth)
 *   POST /api/admin/newsletter/send/:id    — operator wysyła campaign (admin auth)
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../../env.js";
import { err, ok } from "../../lib/responses.js";

export const adminNewsletterRouter = new Hono<HonoEnv>();

function checkAdmin(c: { req: { header(n: string): string | undefined }; env: { ADMIN_API_KEY?: string } }): string | null {
  const expected = c.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY not configured";
  if (c.req.header("X-BP-Admin-Key") !== expected) return "Invalid X-BP-Admin-Key";
  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function newId(prefix: string): string {
  return `${prefix}_${randomToken().slice(0, 20)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// POST /subscribe — called by klient site (server-to-server) when user submits widget
// ---------------------------------------------------------------------------
adminNewsletterRouter.post("/subscribe", async (c) => {
  // Auth: either X-BP-Admin-Key (admin) OR X-BP-Client-Key (klient site server)
  const adminKey = c.env.ADMIN_API_KEY;
  const provided = c.req.header("X-BP-Admin-Key");
  const isAdminAuth = adminKey && provided === adminKey;

  let body: { client_id?: string; email?: string; phone?: string; name?: string; source?: string };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id) return c.json(err("VALIDATION_ERROR", "client_id required"), 400);
  if (!body.email || !EMAIL_RE.test(body.email)) {
    return c.json(err("VALIDATION_ERROR", "email invalid"), 422);
  }

  // If not admin, verify client_key matches a real client with newsletter_sms addon
  if (!isAdminAuth) {
    const clientKey = c.req.header("X-BP-Client-Key");
    if (!clientKey) return c.json(err("AUTH_MISSING_KEY", "X-BP-Client-Key required"), 401);
    const keyHash = await sha256Hex(clientKey);
    const clientCheck = await c.env.DB
      .prepare(`SELECT id FROM clients WHERE id = ? AND api_key_hash = ? LIMIT 1`)
      .bind(body.client_id, keyHash)
      .first<{ id: string }>();
    if (!clientCheck) return c.json(err("AUTH_INVALID_KEY", "Client key mismatch"), 401);
  }

  // Check addon active
  const addon = await c.env.DB
    .prepare(`SELECT id FROM client_addons WHERE client_id = ? AND addon_slug = 'newsletter_sms' AND status IN ('trial','active') LIMIT 1`)
    .bind(body.client_id)
    .first<{ id: number }>();
  if (!addon) {
    return c.json(err("VALIDATION_ERROR", "newsletter_sms addon not active for this client"), 422);
  }

  const emailHash = await sha256Hex(body.email.toLowerCase().trim());
  const phoneHash = body.phone ? await sha256Hex(body.phone) : null;
  const id = newId("nl");
  const token = randomToken();

  try {
    await c.env.DB
      .prepare(
        `INSERT INTO newsletter_subscribers (id, client_id, email_hash, email_enc, phone_hash, phone_enc, name, source, confirm_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (client_id, email_hash) DO UPDATE SET
           confirm_token = excluded.confirm_token,
           opt_out_at = NULL`,
      )
      .bind(
        id, body.client_id, emailHash, `dev:${body.email}`,
        phoneHash, body.phone ? `dev:${body.phone}` : null,
        body.name ?? null, body.source ?? "widget", token,
      )
      .run();
  } catch (e) {
    return c.json(err("INTERNAL_ERROR", e instanceof Error ? e.message : "db insert failed"), 500);
  }

  // Send double opt-in email
  if (c.env.RESEND_API_KEY) {
    const klient = await c.env.DB
      .prepare(`SELECT business_name, primary_domain FROM clients WHERE id = ? LIMIT 1`)
      .bind(body.client_id)
      .first<{ business_name: string; primary_domain: string | null }>();
    const base = klient?.primary_domain ? `https://${klient.primary_domain}` : `https://api.mixturemarketing.pl`;
    const confirmUrl = `${base}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: c.env.RESEND_FROM ?? "admin@mixturemarketing.pl",
        to: body.email,
        subject: `${klient?.business_name ?? "Newsletter"} — potwierdź zapis`,
        html: `<p>Cześć,</p><p>Aby zapisać się na newsletter <strong>${escapeHtml(klient?.business_name ?? "")}</strong>, kliknij poniższy link:</p><p><a href="${confirmUrl}" style="display:inline-block;background:#047857;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Potwierdź zapis</a></p><p style="color:#64748b;font-size:13px;">Link jednorazowy. Jeśli nie zapisywałeś się — zignoruj.</p>`,
        text: `Potwierdź zapis na newsletter: ${confirmUrl}`,
      }),
    }).catch(() => { /* swallow */ });
  }

  return c.json(ok({ id, confirmation_sent: true }), 200);
});

// ---------------------------------------------------------------------------
// GET /confirm?token=...  — public, no auth, klient klika z maila
// ---------------------------------------------------------------------------
adminNewsletterRouter.get("/confirm", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.html(htmlPage("Błąd", "Brak tokenu w linku.", false), 400);

  const sub = await c.env.DB
    .prepare(`SELECT id, client_id, confirmed_at FROM newsletter_subscribers WHERE confirm_token = ? LIMIT 1`)
    .bind(token)
    .first<{ id: string; client_id: string; confirmed_at: string | null }>();
  if (!sub) return c.html(htmlPage("Nieprawidłowy link", "Link jest nieprawidłowy lub wygasł.", false), 404);

  if (sub.confirmed_at) {
    return c.html(htmlPage("Już zapisany", "Twój zapis był już wcześniej potwierdzony.", true), 200);
  }

  await c.env.DB
    .prepare(`UPDATE newsletter_subscribers SET confirmed_at = datetime('now'), confirm_token = NULL WHERE id = ?`)
    .bind(sub.id)
    .run();

  return c.html(htmlPage("Potwierdzone! 🎉", "Dziękujemy — od teraz otrzymasz nasze newslettery.", true), 200);
});

// ---------------------------------------------------------------------------
// GET /unsubscribe?token=... — public, klient klika "wypisz mnie" w mailu campaign
// ---------------------------------------------------------------------------
adminNewsletterRouter.get("/unsubscribe", async (c) => {
  const token = c.req.query("token"); // we'll use subscriber.id as unsubscribe token for simplicity
  if (!token) return c.html(htmlPage("Błąd", "Brak tokenu w linku.", false), 400);

  const res = await c.env.DB
    .prepare(`UPDATE newsletter_subscribers SET opt_out_at = datetime('now'), opt_out_reason = 'user_request' WHERE id = ? AND opt_out_at IS NULL`)
    .bind(token)
    .run();
  const changed = res.meta?.changes ?? 0;
  return c.html(
    htmlPage(
      changed > 0 ? "Wypisany" : "Już wypisany",
      changed > 0 ? "Zostałeś wypisany z newslettera. Już nie otrzymasz wiadomości." : "Twój adres był już wypisany.",
      true,
    ),
    200,
  );
});

// ---------------------------------------------------------------------------
// POST /campaign — operator creates campaign for a klient
// Body: { client_id, subject, body_markdown, channel?, sms_body? }
// ---------------------------------------------------------------------------
adminNewsletterRouter.post("/campaign", async (c) => {
  const authErr = checkAdmin(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  let body: { client_id?: string; subject?: string; body_markdown?: string; channel?: string; sms_body?: string };
  try { body = (await c.req.json()) as typeof body; } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }
  if (!body.client_id || !body.subject || !body.body_markdown) {
    return c.json(err("VALIDATION_ERROR", "client_id, subject, body_markdown required"), 400);
  }
  const channel = body.channel ?? "email";
  if (!["email", "sms", "both"].includes(channel)) {
    return c.json(err("VALIDATION_ERROR", "channel must be email|sms|both"), 400);
  }

  const id = newId("camp");
  await c.env.DB
    .prepare(
      `INSERT INTO newsletter_campaigns (id, client_id, channel, subject, body_markdown, sms_body, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'admin')`,
    )
    .bind(id, body.client_id, channel, body.subject, body.body_markdown, body.sms_body ?? null)
    .run();
  return c.json(ok({ id, status: "draft" }), 201);
});

// ---------------------------------------------------------------------------
// POST /send/:id — operator sends an existing campaign NOW
// ---------------------------------------------------------------------------
adminNewsletterRouter.post("/send/:id", async (c) => {
  const authErr = checkAdmin(c);
  if (authErr) return c.json(err("AUTH_INVALID_KEY", authErr), 401);

  const id = c.req.param("id");
  if (!id) return c.json(err("VALIDATION_ERROR", "campaign id required"), 400);

  const { sendCampaign } = await import("../../../scheduled/newsletter-send.js");
  const result = await sendCampaign(c.env, id);
  return c.json(ok(result), result.ok ? 200 : 422);
});

// ---------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------
function htmlPage(title: string, message: string, ok: boolean): string {
  const color = ok ? "#047857" : "#dc2626";
  return `<!doctype html><html lang="pl"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f8fafc;">
<div style="background:white;padding:32px 40px;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,0.08);text-align:center;max-width:420px;">
<h1 style="color:${color};margin:0 0 12px 0;font-size:1.5rem;">${escapeHtml(title)}</h1>
<p style="color:#475569;margin:0;">${escapeHtml(message)}</p>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
