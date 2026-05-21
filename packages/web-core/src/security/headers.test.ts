import { describe, expect, it } from "vitest";

import {
  applySecurityHeaders,
  buildSecurityHeaders,
  securityMiddleware,
} from "./headers.js";

describe("buildSecurityHeaders", () => {
  it("emits all baseline headers", () => {
    const h = buildSecurityHeaders();
    expect(h["Content-Security-Policy"]).toBeDefined();
    expect(h["Strict-Transport-Security"]).toBeDefined();
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-site");
    expect(h["X-Permitted-Cross-Domain-Policies"]).toBe("none");
  });

  it("HSTS defaults to 2y + includeSubDomains + preload", () => {
    const h = buildSecurityHeaders();
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
  });

  it("HSTS can be customized", () => {
    const h = buildSecurityHeaders({
      hsts: { maxAgeSeconds: 3600, includeSubDomains: false, preload: false },
    });
    expect(h["Strict-Transport-Security"]).toBe("max-age=3600");
  });

  it("HSTS can be disabled", () => {
    const h = buildSecurityHeaders({ hsts: { disabled: true } });
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });

  it("includes nonce in CSP (Astro 6: strict-dynamic removed — see csp.ts)", () => {
    const h = buildSecurityHeaders({ nonce: "abc123" });
    expect(h["Content-Security-Policy"]).toContain("'nonce-abc123'");
  });

  it("Turnstile integration adds CSP entries", () => {
    const h = buildSecurityHeaders({ integrations: { turnstile: true } });
    expect(h["Content-Security-Policy"]).toContain("challenges.cloudflare.com");
  });

  it("hubApi default uses production base URL", () => {
    const h = buildSecurityHeaders({ integrations: { hubApi: true } });
    expect(h["Content-Security-Policy"]).toContain("https://api.mixturemarketing.pl");
  });

  it("hubApi custom base URL", () => {
    const h = buildSecurityHeaders({ integrations: { hubApi: { baseUrl: "https://staging.example.pl" } } });
    expect(h["Content-Security-Policy"]).toContain("https://staging.example.pl");
  });

  it("cspReportOnly switches header name", () => {
    const h = buildSecurityHeaders({ cspReportOnly: true });
    expect(h["Content-Security-Policy-Report-Only"]).toBeDefined();
    expect(h["Content-Security-Policy"]).toBeUndefined();
  });

  it("COEP off by default; opt-in works", () => {
    expect(buildSecurityHeaders()["Cross-Origin-Embedder-Policy"]).toBeUndefined();
    const h = buildSecurityHeaders({ coep: "require-corp" });
    expect(h["Cross-Origin-Embedder-Policy"]).toBe("require-corp");
  });

  it("cspOverrides merge into final CSP", () => {
    const h = buildSecurityHeaders({
      cspOverrides: { "connect-src": ["https://custom.example.pl"] },
    });
    expect(h["Content-Security-Policy"]).toContain("https://custom.example.pl");
  });

  it("plausible custom origin override", () => {
    const h = buildSecurityHeaders({
      integrations: { plausible: { origin: "https://stats.x.pl" } },
    });
    expect(h["Content-Security-Policy"]).toContain("https://stats.x.pl");
  });
});

describe("applySecurityHeaders", () => {
  it("returns a new Response with merged headers", async () => {
    const r = new Response("hello", { status: 200, headers: { "X-Custom": "yes" } });
    const out = applySecurityHeaders(r, { nonce: "xyz" });
    expect(out.headers.get("X-Custom")).toBe("yes");
    expect(out.headers.get("Content-Security-Policy")).toContain("'nonce-xyz'");
    expect(out.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await out.text()).toBe("hello");
    expect(out.status).toBe(200);
  });

  it("preserves status + statusText", () => {
    const r = new Response(null, { status: 301, statusText: "Moved" });
    const out = applySecurityHeaders(r);
    expect(out.status).toBe(301);
    expect(out.statusText).toBe("Moved");
  });
});

describe("securityMiddleware (Hono-style)", () => {
  it("sets headers on context response + generates per-request nonce", async () => {
    const mw = securityMiddleware({ integrations: { turnstile: true } });

    // Mock Hono-like context
    const stored: Record<string, unknown> = {};
    const resHeaders = new Map<string, string>();
    const c = {
      set(key: string, value: unknown) {
        stored[key] = value;
      },
      res: {
        headers: {
          set(name: string, value: string) {
            resHeaders.set(name, value);
          },
        },
      },
    };

    await mw(c, async () => {});

    expect(typeof stored["nonce"]).toBe("string");
    expect(resHeaders.has("Content-Security-Policy")).toBe(true);
    const csp = resHeaders.get("Content-Security-Policy")!;
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("challenges.cloudflare.com");
  });

  it("respects perRequestNonce=false", async () => {
    const mw = securityMiddleware({ perRequestNonce: false });
    const stored: Record<string, unknown> = {};
    const c = {
      set(k: string, v: unknown) {
        stored[k] = v;
      },
      res: {
        headers: {
          set() {
            /* no-op */
          },
        },
      },
    };
    await mw(c, async () => {});
    expect(stored["nonce"]).toBeUndefined();
  });

  it("custom nonceFactory called", async () => {
    let calls = 0;
    const mw = securityMiddleware({
      nonceFactory: () => {
        calls++;
        return "fixed-test-nonce";
      },
    });
    const stored: Record<string, unknown> = {};
    const resHeaders = new Map<string, string>();
    const c = {
      set(k: string, v: unknown) {
        stored[k] = v;
      },
      res: {
        headers: {
          set(n: string, v: string) {
            resHeaders.set(n, v);
          },
        },
      },
    };
    await mw(c, async () => {});
    expect(calls).toBe(1);
    expect(stored["nonce"]).toBe("fixed-test-nonce");
    expect(resHeaders.get("Content-Security-Policy")).toContain("'nonce-fixed-test-nonce'");
  });
});
