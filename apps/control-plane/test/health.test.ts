import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { setupTestEnv } from "./helpers.js";

describe("GET /api/health", () => {
  it("returns ok with db check passing", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();

    const res = await app.fetch(new Request("https://test/api/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.status).toBe("ok");
    const checks = data.checks as { db: { ok: boolean } };
    expect(checks.db.ok).toBe(true);
  });

  it("is public (no auth header needed)", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(new Request("https://test/api/health"), env);
    expect(res.status).toBe(200);
  });

  it("sets X-Request-ID header", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(new Request("https://test/api/health"), env);
    expect(res.headers.get("X-Request-ID")).toBeTruthy();
  });
});
