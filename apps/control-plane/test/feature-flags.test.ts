import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { jsonRequest, setupTestEnv } from "./helpers.js";

describe("GET /api/feature-flags", () => {
  it("returns tier + modules + flags for authenticated klient", async () => {
    const { env, apiKey, clientId } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        client_id: string;
        tier: string;
        modules: string[];
        flags: Record<string, unknown>;
      };
    };
    expect(body.data.client_id).toBe(clientId);
    expect(body.data.tier).toBe("starter");
    expect(body.data.modules).toEqual(["care"]);
    expect(body.data.flags).toEqual({ ai_blog_enabled: false });
  });

  it("sets ETag + Cache-Control", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]+"$/);
    expect(res.headers.get("Cache-Control")).toContain("max-age=300");
  });

  it("returns 304 on matching If-None-Match", async () => {
    const { env, apiKey } = await setupTestEnv();
    const app = createApp();
    const r1 = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    const etag = r1.headers.get("ETag");
    expect(etag).toBeTruthy();

    const r2 = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
        "If-None-Match": etag!,
      }),
      env,
    );
    expect(r2.status).toBe(304);
  });
});
