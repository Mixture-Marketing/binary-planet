import { beforeEach, describe, expect, it } from "vitest";

import {
  buildClearSessionCookie,
  buildSessionCookie,
  createMagicLink,
  findAdminByEmail,
  generateToken,
  readSessionCookie,
  revokeSession,
  sendMagicLinkEmail,
  sha256Hex,
  validateSession,
  verifyMagicLink,
} from "../src/lib/auth.ts";
import { setupTestDb, type TestSetup } from "./helpers.js";

describe("token helpers", () => {
  it("generateToken returns base64url (43 chars, no padding)", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t.length).toBeGreaterThanOrEqual(42);
    expect(t).not.toContain("=");
    expect(t).not.toContain("+");
    expect(t).not.toContain("/");
  });

  it("generateToken values are unique", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });

  it("sha256Hex produces 64-char lowercase hex", async () => {
    const h = await sha256Hex("hello");
    expect(h).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("cookie helpers", () => {
  it("buildSessionCookie includes Secure by default", () => {
    const c = buildSessionCookie("sess_abc");
    expect(c).toContain("mm_admin_session=sess_abc");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toMatch(/Max-Age=\d+/);
  });

  it("buildSessionCookie can omit Secure (local dev)", () => {
    const c = buildSessionCookie("sess_abc", false);
    expect(c).not.toContain("Secure");
  });

  it("buildClearSessionCookie zeroes the cookie", () => {
    const c = buildClearSessionCookie();
    expect(c).toContain("mm_admin_session=;");
    expect(c).toContain("Max-Age=0");
  });

  it("readSessionCookie parses our cookie out of a multi-cookie header", () => {
    const header = "_ga=GA1.2.x; mm_admin_session=sess_xyz; theme=dark";
    expect(readSessionCookie(header)).toBe("sess_xyz");
  });

  it("readSessionCookie returns null when absent", () => {
    expect(readSessionCookie("foo=bar")).toBeNull();
    expect(readSessionCookie(null)).toBeNull();
  });
});

describe("admin user lookup + session lifecycle", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestDb();
  });

  it("findAdminByEmail returns active user (case-insensitive, trimmed)", async () => {
    const u = await findAdminByEmail(setup.db, "  JAKUB@MixtureMarketing.pl  ");
    expect(u).not.toBeNull();
    expect(u!.id).toBe(setup.adminUserId);
    expect(u!.role).toBe("admin");
  });

  it("findAdminByEmail returns null for unknown email", async () => {
    expect(await findAdminByEmail(setup.db, "nobody@example.com")).toBeNull();
  });

  it("findAdminByEmail skips non-active users", async () => {
    await setup.db
      .prepare(
        `INSERT INTO admin_users (id, email, display_name, role, status)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind("usr_disabled", "off@mm.pl", "Off", "va", "disabled")
      .run();
    expect(await findAdminByEmail(setup.db, "off@mm.pl")).toBeNull();
  });

  it("createMagicLink → verifyMagicLink returns user and extends expiry", async () => {
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    expect(token).toMatch(/^sess_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const user = await verifyMagicLink(setup.db, token);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(setup.adminEmail);

    // After verify, expiry should be ~24h out (was 15min)
    const sessionId = token.split(".")[0]!;
    const row = await setup.db
      .prepare(`SELECT expires_at FROM admin_sessions WHERE id = ?`)
      .bind(sessionId)
      .first<{ expires_at: string }>();
    // sqlite returns ISO already containing "Z" (we store JS toISOString) — parse as-is
    const expiresMs = new Date(row!.expires_at).getTime();
    const hoursFromNow = (expiresMs - Date.now()) / (1000 * 60 * 60);
    expect(hoursFromNow).toBeGreaterThan(20);
    expect(hoursFromNow).toBeLessThanOrEqual(25);
  });

  it("verifyMagicLink rejects malformed token", async () => {
    expect(await verifyMagicLink(setup.db, "no-dot")).toBeNull();
    expect(await verifyMagicLink(setup.db, "a.b.c")).toBeNull();
  });

  it("verifyMagicLink rejects unknown sessionId", async () => {
    expect(await verifyMagicLink(setup.db, "sess_unknown.abc")).toBeNull();
  });

  it("verifyMagicLink rejects expired session", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await setup.db
      .prepare(`INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
      .bind("sess_expired", setup.adminUserId, past)
      .run();
    expect(await verifyMagicLink(setup.db, "sess_expired.token")).toBeNull();
  });

  it("validateSession returns user for live session", async () => {
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    const user = await validateSession(setup.db, sessionId);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(setup.adminEmail);
  });

  it("validateSession returns null for revoked session", async () => {
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    await revokeSession(setup.db, sessionId);
    expect(await validateSession(setup.db, sessionId)).toBeNull();
  });

  it("validateSession returns null when user becomes inactive", async () => {
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    await setup.db
      .prepare(`UPDATE admin_users SET status = 'suspended' WHERE id = ?`)
      .bind(setup.adminUserId)
      .run();
    expect(await validateSession(setup.db, sessionId)).toBeNull();
  });
});

describe("sendMagicLinkEmail", () => {
  it("dev mode (no API key) → logs and returns ok:true", async () => {
    const res = await sendMagicLinkEmail({}, {
      to: "test@mm.pl",
      link: "https://example.com/verify?token=abc",
      displayName: "Test",
    });
    expect(res.ok).toBe(true);
  });

  it("non-2xx Resend response → ok:false with status code", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("err", { status: 422 })) as typeof fetch;
    try {
      const res = await sendMagicLinkEmail(
        { RESEND_API_KEY: "fake" },
        { to: "t@mm.pl", link: "x", displayName: "T" },
      );
      expect(res.ok).toBe(false);
      expect(res.error).toContain("422");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fetch throw → returns ok:false with error message", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    try {
      const res = await sendMagicLinkEmail(
        { RESEND_API_KEY: "fake" },
        { to: "t@mm.pl", link: "x", displayName: "T" },
      );
      expect(res.ok).toBe(false);
      expect(res.error).toBe("network down");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
