import { describe, expect, it } from "vitest";

import { createApp } from "../src/api/router.js";
import { jsonRequest, setupTestEnv } from "./helpers.js";

describe("auth middleware (X-BP-Client-Key)", () => {
  it("401 AUTH_MISSING_KEY when header absent", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags"),
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("AUTH_MISSING_KEY");
  });

  it("401 AUTH_INVALID_KEY for unknown key", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": "ck_live_bogus_unknown_key_xxxxxxxxxx",
      }),
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("AUTH_INVALID_KEY");
  });

  it("rejects too-short key without DB lookup", async () => {
    const { env } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": "short",
      }),
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("AUTH_INVALID_KEY");
  });

  it("passes through for valid key + sets authenticatedClientId", async () => {
    const { env, apiKey, clientId } = await setupTestEnv();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { client_id: string } };
    expect(body.data.client_id).toBe(clientId);
  });

  it("AUTH_REVOKED when klient suspended", async () => {
    const { env, apiKey } = await setupTestEnv();
    await env.DB.prepare(`UPDATE clients SET status = 'suspended' WHERE id = 'clk_test'`)
      .bind()
      .run();
    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": apiKey,
      }),
      env,
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe("AUTH_REVOKED");
  });

  it("accepts rotated key via api_key_hash_new column (grace period)", async () => {
    const { env } = await setupTestEnv();

    // Simulate rotation: set a NEW key hash in api_key_hash_new
    const newKey = "ck_live_rotated_key_98765432109876543210";
    const { sha256Hex } = await import("../src/api/lib/hash.js");
    const newHash = await sha256Hex(newKey);
    await env.DB.prepare(`UPDATE clients SET api_key_hash_new = ? WHERE id = 'clk_test'`)
      .bind(newHash)
      .run();

    const app = createApp();
    const res = await app.fetch(
      jsonRequest("GET", "https://test/api/feature-flags", undefined, {
        "X-BP-Client-Key": newKey,
      }),
      env,
    );
    expect(res.status).toBe(200);
  });
});
