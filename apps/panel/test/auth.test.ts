import { beforeEach, describe, expect, it } from "vitest";

import {
  buildClearSessionCookie,
  buildSessionCookie,
  createMagicLink,
  findClientByEmail,
  generateToken,
  readSessionCookie,
  revokeSession,
  sha256Hex,
  validateSession,
  verifyMagicLink,
} from "../src/lib/auth.ts";
import { setupTestDb, type TestSetup } from "./helpers.js";

describe("token + hash helpers", () => {
  it("generateToken returns base64url with no padding", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(t).not.toContain("=");
  });

  it("sha256Hex stable for known input", async () => {
    expect(await sha256Hex("hello")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });
});

describe("cookie helpers", () => {
  it("buildSessionCookie HttpOnly+SameSite+Secure", () => {
    const c = buildSessionCookie("psess_x");
    expect(c).toContain("mm_panel_session=psess_x");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
  });

  it("readSessionCookie picks our key out of multi-cookie header", () => {
    expect(readSessionCookie("_ga=x; mm_panel_session=psess_abc; theme=dark")).toBe("psess_abc");
    expect(readSessionCookie(null)).toBeNull();
  });

  it("buildClearSessionCookie zeros Max-Age", () => {
    expect(buildClearSessionCookie()).toContain("Max-Age=0");
  });
});

describe("findClientByEmail + lifecycle", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestDb();
  });

  it("matches active client by case-insensitive email hash", async () => {
    const c = await findClientByEmail(setup.db, "  KONTAKT@kowalski-slusarz.pl ");
    expect(c).not.toBeNull();
    expect(c!.id).toBe(setup.clientId);
  });

  it("returns null for unknown email", async () => {
    expect(await findClientByEmail(setup.db, "unknown@example.com")).toBeNull();
  });

  it("returns null when client status != active", async () => {
    await setup.db.prepare(`UPDATE clients SET status='paused' WHERE id=?`).bind(setup.clientId).run();
    expect(await findClientByEmail(setup.db, setup.clientEmail)).toBeNull();
  });

  it("createMagicLink → verifyMagicLink returns client + flips consumed_at", async () => {
    const token = await createMagicLink(setup.db, setup.clientId, setup.clientEmail);
    expect(token).toMatch(/^psess_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const c = await verifyMagicLink(setup.db, token);
    expect(c).not.toBeNull();
    expect(c!.id).toBe(setup.clientId);

    const sessionId = token.split(".")[0]!;
    const row = await setup.db.prepare(`SELECT magic_link_consumed_at, expires_at FROM panel_sessions WHERE id=?`).bind(sessionId).first<{ magic_link_consumed_at: string; expires_at: string }>();
    expect(row?.magic_link_consumed_at).toBeTruthy();
    const hoursOut = (new Date(row!.expires_at).getTime() - Date.now()) / 3.6e6;
    expect(hoursOut).toBeGreaterThan(20);
    expect(hoursOut).toBeLessThanOrEqual(25);
  });

  it("verifyMagicLink rejects token already consumed", async () => {
    const token = await createMagicLink(setup.db, setup.clientId, setup.clientEmail);
    expect(await verifyMagicLink(setup.db, token)).not.toBeNull();
    expect(await verifyMagicLink(setup.db, token)).toBeNull();
  });

  it("verifyMagicLink rejects wrong token hash for valid sessionId", async () => {
    const token = await createMagicLink(setup.db, setup.clientId, setup.clientEmail);
    const sessionId = token.split(".")[0]!;
    expect(await verifyMagicLink(setup.db, `${sessionId}.wrong-token`)).toBeNull();
  });

  it("verifyMagicLink rejects malformed token", async () => {
    expect(await verifyMagicLink(setup.db, "no-dot")).toBeNull();
    expect(await verifyMagicLink(setup.db, "a.b.c")).toBeNull();
  });

  it("validateSession works after verify, returns null after revoke", async () => {
    const token = await createMagicLink(setup.db, setup.clientId, setup.clientEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    const c = await validateSession(setup.db, sessionId);
    expect(c).not.toBeNull();

    await revokeSession(setup.db, sessionId);
    expect(await validateSession(setup.db, sessionId)).toBeNull();
  });

  it("validateSession returns null for unconsumed session (link not clicked yet)", async () => {
    const token = await createMagicLink(setup.db, setup.clientId, setup.clientEmail);
    const sessionId = token.split(".")[0]!;
    // Session row exists but magic_link_consumed_at is NULL until verify
    expect(await validateSession(setup.db, sessionId)).toBeNull();
  });
});
