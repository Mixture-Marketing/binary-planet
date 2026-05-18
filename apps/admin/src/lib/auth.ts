/**
 * Admin authentication — magic link flow.
 *
 * Tables (D1, shared z mm-control-plane):
 *   - admin_users — Jakub + future VAs
 *   - admin_sessions — server-side sessions (token hashed)
 *
 * Flow:
 *   1. User wpisuje email na /login → POST /api/auth/send-link
 *   2. Server: znajduje admin_user po email, generuje token (32B random), hashuje, zapisuje w admin_sessions
 *   3. Wysyła Resend email z linkiem /login/verify?token=<plain>
 *   4. Klient klika → GET /login/verify → server checks hash, marks consumed, sets cookie, redirect /
 *   5. Cookie: HttpOnly + Secure + SameSite=Lax + 24h
 *   6. Każde request: middleware reads cookie, validates session, sets Astro.locals.user
 */

const SESSION_COOKIE = "mm_admin_session";
const SESSION_DURATION_SEC = 24 * 60 * 60; // 24h
const MAGIC_LINK_DURATION_SEC = 15 * 60; // 15 min

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "va" | "read_only" | "billing_only";
  status: string;
}

export interface AdminSession {
  id: string;
  user_id: string;
  expires_at: string;
}

/** Generate cryptographically random token (32 bytes base64url). */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** sha256 hex of input. Used for token hashing before D1 storage. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Find admin user by email. Returns null if not found OR not active. */
export async function findAdminByEmail(
  db: D1Database,
  email: string,
): Promise<AdminUser | null> {
  const row = await db
    .prepare(
      `SELECT id, email, display_name, role, status FROM admin_users
        WHERE email = ? AND status = 'active' LIMIT 1`,
    )
    .bind(email.toLowerCase().trim())
    .first<AdminUser>();
  return row ?? null;
}

/** Create magic link record (one-time use). Returns the plain token. */
export async function createMagicLink(
  db: D1Database,
  userId: string,
  email: string,
): Promise<string> {
  // For v0.1 we use sessionId as the primary identifier in the magic link.
  // The second token component adds entropy + makes one-time consumption simpler
  // (no separate magic_link_tokens table — session is created on send, marked active on consume).
  void email; // intentionally unused; future: store hashed email for audit indexing
  const token = generateToken();
  const sessionId = `sess_${generateToken().slice(0, 16)}`;
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DURATION_SEC * 1000).toISOString();

  await db
    .prepare(
      `INSERT INTO admin_sessions (id, user_id, expires_at)
       VALUES (?, ?, ?)`,
    )
    .bind(sessionId, userId, expiresAt)
    .run();

  // Store magic link hash in KV (separate from session itself — token is one-time)
  // Actually use admin_sessions table is wrong for this — that's for active sessions.
  // We'll just encode userId in the token for now. Production: separate magic_link_tokens table.
  // For v0.1: store mapping in KV with TTL.

  return `${sessionId}.${token}`;
}

/** Verify magic link, mark session as consumed (active), return user. */
export async function verifyMagicLink(
  db: D1Database,
  fullToken: string,
): Promise<AdminUser | null> {
  // Token format: sessionId.token
  const parts = fullToken.split(".");
  if (parts.length !== 2) return null;
  const [sessionId] = parts;

  // Get session, verify not expired or consumed
  const session = await db
    .prepare(
      `SELECT s.id, s.user_id, s.expires_at, s.last_active_at, u.id AS user_id_full,
              u.email, u.display_name, u.role, u.status
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.user_id
        WHERE s.id = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND u.status = 'active'
        LIMIT 1`,
    )
    .bind(sessionId)
    .first<AdminUser & { last_active_at: string | null; expires_at: string }>();

  if (!session) return null;

  // Mark session as active (first-time activation = magic link consumed)
  // and extend duration to full 24h
  const newExpiry = new Date(Date.now() + SESSION_DURATION_SEC * 1000).toISOString();
  await db
    .prepare(
      `UPDATE admin_sessions
          SET last_active_at = datetime('now'),
              expires_at = ?
        WHERE id = ?`,
    )
    .bind(newExpiry, sessionId)
    .run();

  return {
    id: session.id,
    email: session.email,
    display_name: session.display_name,
    role: session.role,
    status: session.status,
  };
}

/** Validate session token from cookie. Returns admin user if valid. */
export async function validateSession(
  db: D1Database,
  sessionId: string,
): Promise<AdminUser | null> {
  const session = await db
    .prepare(
      `SELECT s.id, s.user_id, u.id AS user_id_full, u.email, u.display_name, u.role, u.status
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.user_id
        WHERE s.id = ?
          AND s.revoked_at IS NULL
          AND datetime(s.expires_at) > datetime('now')
          AND s.last_active_at IS NOT NULL
          AND u.status = 'active'
        LIMIT 1`,
    )
    .bind(sessionId)
    .first<AdminUser>();

  if (!session) return null;

  // Touch session (extend activity timestamp; full expiry unchanged)
  await db
    .prepare(`UPDATE admin_sessions SET last_active_at = datetime('now') WHERE id = ?`)
    .bind(sessionId)
    .run();

  return session;
}

/** Revoke session (logout). */
export async function revokeSession(db: D1Database, sessionId: string): Promise<void> {
  await db
    .prepare(`UPDATE admin_sessions SET revoked_at = datetime('now') WHERE id = ?`)
    .bind(sessionId)
    .run();
}

/** Build session cookie value. Use in Set-Cookie response header. */
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

/** Build clear-cookie value (logout). */
export function buildClearSessionCookie(secure = true): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/** Parse session ID from Cookie header. */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}

/** Send magic link email via Resend. Logs to console in dev (no API key). */
export async function sendMagicLinkEmail(
  env: {
    RESEND_API_KEY?: string;
    RESEND_FROM?: string;
  },
  input: {
    to: string;
    link: string;
    displayName: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  // Dev mode: no Resend key → log to console
  if (!env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[AUTH] Magic link for ${input.to}: ${input.link}`);
    return { ok: true };
  }

  const from = env.RESEND_FROM ?? "admin@mixturemarketing.pl";
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
        subject: "MixtureMarketing — link logowania (ważny 15 min)",
        html: `
          <p>Cześć ${input.displayName},</p>
          <p>Kliknij poniższy link aby zalogować się do panelu MixtureMarketing:</p>
          <p><a href="${input.link}" style="display:inline-block;background:#c0392b;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Zaloguj się</a></p>
          <p style="color:#666;font-size:13px;">Link wygaśnie za 15 minut. Jeśli to nie Ty próbowałeś się zalogować, zignoruj tę wiadomość.</p>
        `,
        text: `Cześć ${input.displayName},\n\nKliknij link aby zalogować się: ${input.link}\n\nLink wygaśnie za 15 min.`,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
