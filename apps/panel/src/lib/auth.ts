/**
 * Klient panel — magic link auth.
 *
 * Tables:
 *   - clients — klient core (we read business_name, tier, status)
 *   - client_contacts — email lookup by sha256(email)
 *   - panel_sessions — server-side session (token hashed, 24h after consume)
 *
 * Flow:
 *   1. Klient wpisuje email na /login -> POST /api/auth/send-link
 *   2. Server: znajduje client_contacts po contact_email_hash + JOIN clients (status='active')
 *   3. Generuje random token, zapisuje session (id=sessionId, magic_link_token_hash=sha256(token),
 *      email_hash=email_hash, expires_at=now+15min, consumed_at=NULL)
 *   4. Wysyla Resend email z linkiem /login/verify?token={sessionId}.{token}
 *   5. Klient klika -> GET /login/verify -> server checks token hash + not consumed + not expired
 *      -> marks consumed_at, extends expires_at to 24h, sets cookie
 *   6. Cookie: HttpOnly + Secure + SameSite=Lax + 24h
 *   7. Middleware reads cookie, validates session, sets Astro.locals.client
 *
 * Differs from admin auth:
 *   - Hashes the token separately (one-time link is independently verifiable)
 *   - Sessions tied to client_id, not admin_user_id
 *   - Email lookup goes through client_contacts.contact_email_hash (deterministic sha256)
 */

const SESSION_COOKIE = "mm_panel_session";
const SESSION_DURATION_SEC = 24 * 60 * 60;
const MAGIC_LINK_DURATION_SEC = 15 * 60;

export interface PanelClient {
  id: string;
  business_name: string;
  tier: "starter" | "standard" | "premium";
  status: string;
}

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Find an active klient by contact email. Returns null on no match or non-active client. */
export async function findClientByEmail(
  db: D1Database,
  email: string,
): Promise<PanelClient | null> {
  const emailHash = await sha256Hex(email.toLowerCase().trim());
  return await db
    .prepare(
      `SELECT c.id, c.business_name, c.tier, c.status
         FROM client_contacts cc
         JOIN clients c ON c.id = cc.client_id
        WHERE cc.contact_email_hash = ?
          AND c.status IN ('pending', 'active', 'provisioning')
        LIMIT 1`,
    )
    .bind(emailHash)
    .first<PanelClient>();
}

/** Create magic link record. Returns the plain token to send via email (format: sessionId.token). */
export async function createMagicLink(
  db: D1Database,
  clientId: string,
  email: string,
): Promise<string> {
  const token = generateToken();
  const sessionId = `psess_${generateToken().slice(0, 16)}`;
  const tokenHash = await sha256Hex(token);
  const emailHash = await sha256Hex(email.toLowerCase().trim());
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DURATION_SEC * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO panel_sessions (
         id, client_id, magic_link_token_hash, magic_link_sent_to_email_hash, expires_at
       ) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(sessionId, clientId, tokenHash, emailHash, expiresAt)
    .run();

  return `${sessionId}.${token}`;
}

/** Verify magic link: split → look up by sessionId → check token hash + not consumed + not expired → activate. */
export async function verifyMagicLink(
  db: D1Database,
  fullToken: string,
): Promise<PanelClient | null> {
  const parts = fullToken.split(".");
  if (parts.length !== 2) return null;
  const [sessionId, plainToken] = parts;
  if (!sessionId || !plainToken) return null;

  const tokenHash = await sha256Hex(plainToken);

  const row = await db
    .prepare(
      `SELECT s.id, s.client_id, c.business_name, c.tier, c.status
         FROM panel_sessions s
         JOIN clients c ON c.id = s.client_id
        WHERE s.id = ?
          AND s.magic_link_token_hash = ?
          AND s.magic_link_consumed_at IS NULL
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND c.status IN ('pending', 'active', 'provisioning')
        LIMIT 1`,
    )
    .bind(sessionId, tokenHash)
    .first<{ id: string; client_id: string; business_name: string; tier: PanelClient["tier"]; status: string }>();

  if (!row) return null;

  const newExpiry = new Date(Date.now() + SESSION_DURATION_SEC * 1000).toISOString();
  await db
    .prepare(
      `UPDATE panel_sessions
          SET magic_link_consumed_at = datetime('now'),
              last_active_at = datetime('now'),
              expires_at = ?
        WHERE id = ?`,
    )
    .bind(newExpiry, sessionId)
    .run();

  return {
    id: row.client_id,
    business_name: row.business_name,
    tier: row.tier,
    status: row.status,
  };
}

/** Validate an active session (post-verify) by sessionId from cookie. */
export async function validateSession(
  db: D1Database,
  sessionId: string,
): Promise<PanelClient | null> {
  const row = await db
    .prepare(
      `SELECT s.client_id, c.business_name, c.tier, c.status
         FROM panel_sessions s
         JOIN clients c ON c.id = s.client_id
        WHERE s.id = ?
          AND s.revoked_at IS NULL
          AND s.magic_link_consumed_at IS NOT NULL
          AND datetime(s.expires_at) > datetime('now')
          AND c.status IN ('pending', 'active', 'provisioning')
        LIMIT 1`,
    )
    .bind(sessionId)
    .first<{ client_id: string; business_name: string; tier: PanelClient["tier"]; status: string }>();

  if (!row) return null;

  // Touch last_active_at
  await db
    .prepare(`UPDATE panel_sessions SET last_active_at = datetime('now') WHERE id = ?`)
    .bind(sessionId)
    .run();

  return {
    id: row.client_id,
    business_name: row.business_name,
    tier: row.tier,
    status: row.status,
  };
}

export async function revokeSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare(`UPDATE panel_sessions SET revoked_at = datetime('now') WHERE id = ?`)
    .bind(sessionId)
    .run();
}

export function buildSessionCookie(sessionId: string, secure = true): string {
  const parts = [
    `${SESSION_COOKIE}=${sessionId}`,
    "Path=/",
    `Max-Age=${SESSION_DURATION_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearSessionCookie(secure = true): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}

export async function sendMagicLinkEmail(
  env: { RESEND_API_KEY?: string; RESEND_FROM?: string },
  input: { to: string; link: string; businessName: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[PANEL AUTH] Magic link for ${input.to}: ${input.link}`);
    return { ok: true };
  }

  const from = env.RESEND_FROM ?? "panel@mixturemarketing.pl";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: `Panel klienta ${input.businessName} — link logowania (15 min)`,
        html: `
          <p>Cześć,</p>
          <p>Kliknij poniższy link aby zalogować się do panelu klienta ${input.businessName}:</p>
          <p><a href="${input.link}" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Zaloguj się</a></p>
          <p style="color:#666;font-size:13px;">Link wygaśnie za 15 minut. Jeśli to nie Ty próbowałeś się zalogować, zignoruj tę wiadomość.</p>
        `,
        text: `Zaloguj się do panelu ${input.businessName}: ${input.link}\n\nLink wygaśnie za 15 min.`,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
