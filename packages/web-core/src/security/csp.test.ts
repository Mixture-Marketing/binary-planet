import { describe, expect, it } from "vitest";

import {
  defaultCspDirectives,
  ga4Csp,
  hubApiCsp,
  mergeCsp,
  plausibleCsp,
  renderCsp,
  turnstileCsp,
} from "./csp.js";

describe("renderCsp", () => {
  it("joins directives with '; '", () => {
    const out = renderCsp({
      "default-src": ["'self'"],
      "script-src": ["'self'", "'nonce-abc'"],
    });
    expect(out).toBe("default-src 'self'; script-src 'self' 'nonce-abc'");
  });

  it("includes sentinel directives when true", () => {
    const out = renderCsp({ "upgrade-insecure-requests": true });
    expect(out).toBe("upgrade-insecure-requests");
  });

  it("omits sentinel directives when false", () => {
    const out = renderCsp({ "upgrade-insecure-requests": false });
    expect(out).toBe("");
  });

  it("omits empty source-list directives", () => {
    const out = renderCsp({ "default-src": ["'self'"], "img-src": [] });
    expect(out).toBe("default-src 'self'");
  });

  it("includes report-uri as string", () => {
    const out = renderCsp({ "report-uri": "https://example.pl/csp-report" });
    expect(out).toBe("report-uri https://example.pl/csp-report");
  });
});

describe("defaultCspDirectives", () => {
  it("strict baseline with nonce + strict-dynamic", () => {
    const d = defaultCspDirectives({ nonce: "abc" });
    expect(d["script-src"]).toContain("'self'");
    expect(d["script-src"]).toContain("'strict-dynamic'");
    expect(d["script-src"]).toContain("'nonce-abc'");
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["frame-ancestors"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["upgrade-insecure-requests"]).toBe(true);
  });

  it("script-src-attr 'none' (no inline event handlers)", () => {
    const d = defaultCspDirectives();
    expect(d["script-src-attr"]).toEqual(["'none'"]);
  });

  it("allows data: images by default, can be disabled", () => {
    const dDef = defaultCspDirectives();
    expect(dDef["img-src"]).toContain("data:");
    const dNo = defaultCspDirectives({ allowDataImages: false });
    expect(dNo["img-src"]).not.toContain("data:");
  });
});

describe("mergeCsp", () => {
  it("concats source lists + dedupes", () => {
    const base = { "script-src": ["'self'"] };
    const ext = { "script-src": ["'self'", "https://x.pl"] };
    const out = mergeCsp(base, ext);
    expect(out["script-src"]).toEqual(["'self'", "https://x.pl"]);
  });

  it("override semantics for sentinel directives", () => {
    const base = { "upgrade-insecure-requests": true };
    const ext = { "upgrade-insecure-requests": false };
    expect(mergeCsp(base, ext)["upgrade-insecure-requests"]).toBe(false);
  });

  it("merges multiple overrides in order", () => {
    const a = mergeCsp(
      { "img-src": ["'self'"] },
      { "img-src": ["https://a.pl"] },
      { "img-src": ["https://b.pl"] },
    );
    expect(a["img-src"]).toEqual(["'self'", "https://a.pl", "https://b.pl"]);
  });
});

describe("integration extensions", () => {
  it("turnstileCsp adds challenges.cloudflare.com", () => {
    const t = turnstileCsp();
    expect(t["script-src"]).toContain("https://challenges.cloudflare.com");
    expect(t["frame-src"]).toContain("https://challenges.cloudflare.com");
  });

  it("plausibleCsp default uses plausible.io", () => {
    const p = plausibleCsp();
    expect(p["script-src"]).toContain("https://plausible.io");
    expect(p["connect-src"]).toContain("https://plausible.io");
  });

  it("plausibleCsp accepts custom origin (self-hosted)", () => {
    const p = plausibleCsp("https://analytics.mixturemarketing.pl");
    expect(p["script-src"]).toContain("https://analytics.mixturemarketing.pl");
  });

  it("ga4Csp covers script + connect + img", () => {
    const g = ga4Csp();
    expect(g["script-src"]).toContain("https://www.googletagmanager.com");
    expect(g["connect-src"]).toContain("https://www.google-analytics.com");
  });

  it("hubApiCsp extracts origin from URL", () => {
    const h = hubApiCsp("https://api.mixturemarketing.pl/some/path");
    expect(h["connect-src"]).toEqual(["https://api.mixturemarketing.pl"]);
  });
});

describe("end-to-end: default + turnstile + plausible", () => {
  it("merged CSP renders correctly", () => {
    const csp = mergeCsp(defaultCspDirectives({ nonce: "xyz" }), turnstileCsp(), plausibleCsp());
    const str = renderCsp(csp);
    expect(str).toContain("'nonce-xyz'");
    expect(str).toContain("https://challenges.cloudflare.com");
    expect(str).toContain("https://plausible.io");
    expect(str).toContain("upgrade-insecure-requests");
  });
});
