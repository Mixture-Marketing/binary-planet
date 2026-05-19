import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv, type TestSetup } from "./helpers.js";

describe("GET /api/sveltia/auth (OAuth start)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupTestEnv();
    setup.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.test_client_id";
    setup.env.GITHUB_OAUTH_CLIENT_SECRET = "test_secret";
  });

  it("redirects to GitHub authorize URL with state + client_id", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/auth?provider=github&site_id=kowalski-slusarz.pl&scope=repo"),
      setup.env,
    );
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location");
    expect(loc).not.toBeNull();
    const u = new URL(loc!);
    expect(u.origin + u.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(u.searchParams.get("client_id")).toBe("Iv1.test_client_id");
    expect(u.searchParams.get("scope")).toBe("repo");
    expect(u.searchParams.get("state")).toBeTruthy();
    expect(u.searchParams.get("redirect_uri")).toBe("https://hub.test/api/sveltia/callback");
  });

  it("stores state in KV with site_id metadata", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/auth?provider=github&site_id=kowalski-slusarz.pl"),
      setup.env,
    );
    const loc = new URL(res.headers.get("Location")!);
    const state = loc.searchParams.get("state");
    const stateData = await setup.env.CONFIG.get(`sveltia_oauth_state:${state}`);
    expect(stateData).toBeTruthy();
    const parsed = JSON.parse(stateData!) as { site_id: string };
    expect(parsed.site_id).toBe("kowalski-slusarz.pl");
  });

  it("rejects non-github provider", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/auth?provider=gitlab"),
      setup.env,
    );
    expect(res.status).toBe(400);
  });

  it("500 when GITHUB_OAUTH_CLIENT_ID missing", async () => {
    setup.env.GITHUB_OAUTH_CLIENT_ID = undefined;
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/auth?provider=github"),
      setup.env,
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/sveltia/callback", () => {
  let setup: TestSetup;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    setup = await setupTestEnv();
    setup.env.GITHUB_OAUTH_CLIENT_ID = "Iv1.test_client_id";
    setup.env.GITHUB_OAUTH_CLIENT_SECRET = "test_secret";
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function seedState(setup: TestSetup, state: string, siteId = "kowalski-slusarz.pl"): Promise<void> {
    await setup.env.CONFIG.put(
      `sveltia_oauth_state:${state}`,
      JSON.stringify({ site_id: siteId, scope: "repo", origin: "https://kowalski-slusarz.pl", created_at: Date.now() }),
      { expirationTtl: 600 },
    );
  }

  it("exchanges code for token and returns HTML with success postMessage", async () => {
    const app = createApp();
    await seedState(setup, "valid-state-xyz");

    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "https://github.com/login/oauth/access_token") {
        return new Response(
          JSON.stringify({ access_token: "ghu_real_token_xyz", token_type: "bearer", scope: "repo" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as unknown as typeof fetch;

    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?code=gh_code_xyz&state=valid-state-xyz"),
      setup.env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("authorization:github:success");
    expect(html).toContain("ghu_real_token_xyz");
    expect(html).toContain("postMessage");
  });

  it("state is single-use — second callback with same state fails", async () => {
    const app = createApp();
    await seedState(setup, "one-time-state");
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ access_token: "tok", token_type: "bearer" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const r1 = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?code=c1&state=one-time-state"),
      setup.env,
    );
    expect(r1.status).toBe(200);
    const html1 = await r1.text();
    expect(html1).toContain("success");

    const r2 = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?code=c2&state=one-time-state"),
      setup.env,
    );
    expect(r2.status).toBe(200);
    const html2 = await r2.text();
    expect(html2).toContain("error");
    expect(html2).toContain("Invalid or expired state");
  });

  it("rejects unknown state", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?code=c&state=never-seen"),
      setup.env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Invalid or expired state");
  });

  it("propagates GitHub error parameter (user denied authorization)", async () => {
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?error=access_denied&state=x"),
      setup.env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("authorization:github:error");
    expect(html).toContain("access_denied");
  });

  it("handles GitHub token endpoint error (e.g. bad code)", async () => {
    const app = createApp();
    await seedState(setup, "state-for-bad-code");
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "bad_verification_code", error_description: "Wrong code" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const res = await app.fetch(
      new Request("https://hub.test/api/sveltia/callback?code=bad&state=state-for-bad-code"),
      setup.env,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("authorization:github:error");
    expect(html).toContain("bad_verification_code");
  });
});
