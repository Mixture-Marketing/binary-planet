/**
 * Middleware integration tests — auth gate + CSP nonce + security headers.
 *
 * Astro's defineMiddleware just types the handler — we mock it to identity so
 * the exported onRequest can be invoked with a fake APIContext.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
}));

import { buildSessionCookie, createMagicLink, verifyMagicLink } from "../src/lib/auth.ts";
import { setupTestDb, type TestSetup } from "./helpers.js";
import { setMockEnv } from "./mocks/cloudflare-workers.ts";

interface FakeLocals {
  runtime?: { env: { DB: D1Database } };
  user?: { id: string; email: string; displayName: string; role: string };
  nonce?: string;
}

interface FakeContext {
  request: Request;
  locals: FakeLocals;
  redirect: (url: string, status?: number) => Response;
}

function buildContext(opts: {
  path: string;
  db?: D1Database;
  cookie?: string;
}): FakeContext {
  const headers = new Headers();
  if (opts.cookie) headers.set("Cookie", opts.cookie);

  const locals: FakeLocals = {};
  if (opts.db) locals.runtime = { env: { DB: opts.db } };

  return {
    request: new Request(`https://app.mixturemarketing.pl${opts.path}`, { headers }),
    locals,
    redirect: (url, status = 302) =>
      new Response(null, { status, headers: { Location: url } }),
  };
}

describe("middleware auth gate", () => {
  let setup: TestSetup;
  let onRequest: (ctx: FakeContext, next: () => Promise<Response>) => Promise<Response>;

  beforeEach(async () => {
    setup = await setupTestDb();
    // Inject DB into cloudflare:workers mock — middleware now reads env from there.
    setMockEnv({ DB: setup.db });
    // Dynamic import AFTER vi.mock is in place
    const mod = await import("../src/middleware.ts");
    onRequest = mod.onRequest as unknown as typeof onRequest;
  });

  it("unauthenticated request to protected path → 302 /login with next= param", async () => {
    const ctx = buildContext({ path: "/clients", db: setup.db });
    const res = await onRequest(ctx, async () => new Response("should not run"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?next=%2Fclients");
  });

  it("unauthenticated request to /login is allowed (no redirect)", async () => {
    const ctx = buildContext({ path: "/login", db: setup.db });
    const next = vi.fn(async () => new Response("<html>login</html>", { headers: { "Content-Type": "text/html" } }));
    const res = await onRequest(ctx, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
  });

  it("unauthenticated request to /api/auth/send-link is allowed", async () => {
    const ctx = buildContext({ path: "/api/auth/send-link", db: setup.db });
    const next = vi.fn(async () => new Response("ok"));
    await onRequest(ctx, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("authenticated request to protected path → passes through with security headers", async () => {
    // Create live session
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    const ctx = buildContext({
      path: "/",
      db: setup.db,
      cookie: buildSessionCookie(sessionId, false),
    });
    const next = vi.fn(async () => new Response("<html>home</html>", { headers: { "Content-Type": "text/html" } }));
    const res = await onRequest(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).toBe(200);
    expect(ctx.locals.user).toBeDefined();
    expect(ctx.locals.user!.email).toBe(setup.adminEmail);
    expect(ctx.locals.nonce).toMatch(/^[A-Za-z0-9+/=_-]+$/);

    // Security headers applied
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).not.toBeNull();
    expect(csp).toContain(`'nonce-${ctx.locals.nonce}'`);
    expect(res.headers.get("Strict-Transport-Security")).not.toBeNull();
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("authenticated user hitting /login → 302 / (already logged in)", async () => {
    const token = await createMagicLink(setup.db, setup.adminUserId, setup.adminEmail);
    await verifyMagicLink(setup.db, token);
    const sessionId = token.split(".")[0]!;

    const ctx = buildContext({
      path: "/login",
      db: setup.db,
      cookie: buildSessionCookie(sessionId, false),
    });
    const res = await onRequest(ctx, async () => new Response("should not run"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
  });

  it("invalid session cookie → treated as unauthenticated", async () => {
    const ctx = buildContext({
      path: "/clients",
      db: setup.db,
      cookie: "mm_admin_session=sess_garbage",
    });
    const res = await onRequest(ctx, async () => new Response("should not run"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/login");
    expect(ctx.locals.user).toBeUndefined();
  });

  it("static asset path (/_astro/*) skips security headers", async () => {
    // Static assets bypass auth (PUBLIC_PATHS check) AND skip header application
    const ctx = buildContext({ path: "/_astro/index.abc.js", db: setup.db });
    const next = vi.fn(
      async () =>
        new Response("/* js */", {
          headers: { "Content-Type": "application/javascript" },
        }),
    );
    const res = await onRequest(ctx, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  it("nonce is per-request (different requests get different nonces)", async () => {
    const ctx1 = buildContext({ path: "/login", db: setup.db });
    const ctx2 = buildContext({ path: "/login", db: setup.db });
    await onRequest(ctx1, async () => new Response("ok", { headers: { "Content-Type": "text/html" } }));
    await onRequest(ctx2, async () => new Response("ok", { headers: { "Content-Type": "text/html" } }));
    expect(ctx1.locals.nonce).not.toBe(ctx2.locals.nonce);
    expect(ctx1.locals.nonce).toBeTruthy();
  });
});
