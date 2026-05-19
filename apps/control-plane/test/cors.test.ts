import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv } from "./helpers.js";

describe("CORS middleware", () => {
  it("preflight OPTIONS from mixturemarketing.pl returns 204 + headers", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/admin/preonboard", {
        method: "OPTIONS",
        headers: {
          Origin: "https://mixturemarketing.pl",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, X-BP-Preonboard-Key",
        },
      }),
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://mixturemarketing.pl");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-BP-Preonboard-Key");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("preflight from disallowed origin returns 403", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/admin/preonboard", {
        method: "OPTIONS",
        headers: {
          Origin: "https://evil.example.com",
          "Access-Control-Request-Method": "POST",
        },
      }),
      env,
    );
    expect(res.status).toBe(403);
  });

  it("CF Pages preview deploys for mixturemarketing-stona accepted", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const previewOrigins = [
      "https://main.mixturemarketing-stona.pages.dev",
      "https://feat-abonament-v2.mixturemarketing-stona.pages.dev",
      "https://abc123def.mixturemarketing-stona.pages.dev",
    ];
    for (const origin of previewOrigins) {
      const res = await app.fetch(
        new Request("https://hub.test/api/admin/preonboard", {
          method: "OPTIONS",
          headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
        }),
        env,
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    }
  });

  it("other pages.dev projects NOT allowed", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/admin/preonboard", {
        method: "OPTIONS",
        headers: { Origin: "https://malicious-project.pages.dev", "Access-Control-Request-Method": "POST" },
      }),
      env,
    );
    expect(res.status).toBe(403);
  });

  it("dev localhost ports accepted by regex", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    for (const port of ["4321", "4322", "4323", "5173", "3000"]) {
      const res = await app.fetch(
        new Request("https://hub.test/api/admin/preonboard", {
          method: "OPTIONS",
          headers: {
            Origin: `http://localhost:${port}`,
            "Access-Control-Request-Method": "POST",
          },
        }),
        env,
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(`http://localhost:${port}`);
    }
  });

  it("actual POST gets CORS headers added to response", async () => {
    const { env } = await setupTestEnv();
    env.PREONBOARD_PUBLIC_KEY = "test-key";
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/admin/preonboard", {
        method: "POST",
        headers: {
          Origin: "https://mixturemarketing.pl",
          "Content-Type": "application/json",
          "X-BP-Preonboard-Key": "test-key",
          "CF-Connecting-IP": "1.1.1.1",
        },
        body: JSON.stringify({
          business_name: "Test",
          email: "test@example.com",
          phone: "+48171234567",
          nip: "1234567890",
          tier: "starter",
          consent_processing: true,
          consent_text_version: "v1.0",
        }),
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://mixturemarketing.pl");
    expect(res.headers.get("Vary")).toContain("Origin");
  });

  it("server-to-server request (no Origin header) passes through unchanged", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/health"),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("response from disallowed origin has NO CORS headers (browser blocks)", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      new Request("https://hub.test/api/health", {
        headers: { Origin: "https://evil.example.com" },
      }),
      env,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
