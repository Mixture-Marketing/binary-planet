import { describe, expect, it } from "vitest";

import { createFeatureFlagClient } from "./client.js";

function makeKv(): KVNamespace {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kv: any = {
    async get(key: string) {
      const e = store.get(key);
      if (!e) return null;
      if (e.expiresAt && e.expiresAt < Date.now()) return null;
      return e.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const entry: { value: string; expiresAt?: number } = { value };
      if (opts?.expirationTtl) entry.expiresAt = Date.now() + opts.expirationTtl * 1000;
      store.set(key, entry);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = "" }: { prefix?: string } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
  return kv as KVNamespace;
}

function mockFetch(response: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(response), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;
}

describe("createFeatureFlagClient", () => {
  it("merges tier defaults + base config modules", async () => {
    const ff = createFeatureFlagClient({
      config: {
        clientId: "clk_1",
        tier: "starter",
        baseConfig: { modules: ["citation_basic"] },
      },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: mockFetch({ data: null }),
    });
    const resolved = await ff.resolve();
    expect(resolved.modules.has("care")).toBe(true); // tier default
    expect(resolved.modules.has("local_basic")).toBe(true); // tier default
    expect(resolved.modules.has("citation_basic")).toBe(true); // base config
    expect(resolved.modules.has("ai_blog")).toBe(false); // not in any
  });

  it("hub override adds modules on top", async () => {
    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "starter", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: mockFetch({
        data: {
          client_id: "clk_1",
          tier: "starter",
          modules: ["ai_blog"],
          refreshed_at: "2026-05-18T00:00:00Z",
        },
      }),
    });
    const r = await ff.resolve();
    expect(r.modules.has("care")).toBe(true);
    expect(r.modules.has("ai_blog")).toBe(true);
  });

  it("hub failure → falls back to base config (graceful)", async () => {
    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "premium", baseConfig: { modules: ["reputation"] } },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: (async () => new Response("err", { status: 500 })) as typeof fetch,
    });
    const r = await ff.resolve();
    expect(r.modules.has("ai_blog")).toBe(true); // premium default
    expect(r.modules.has("reputation")).toBe(true); // base config
  });

  it("isModuleEnabled returns proper boolean", async () => {
    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "starter", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: mockFetch({ data: null }),
    });
    expect(await ff.isModuleEnabled("care")).toBe(true);
    expect(await ff.isModuleEnabled("ai_blog")).toBe(false);
  });

  it("getBudget reads from base + hub overrides", async () => {
    const ff = createFeatureFlagClient({
      config: {
        clientId: "clk_1",
        tier: "premium",
        baseConfig: { budgets: { ai_monthly_usd: 100 } },
      },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: mockFetch({
        data: {
          client_id: "clk_1",
          tier: "premium",
          modules: [],
          budgets: { ai_monthly_usd: 200 }, // hub overrides base
          refreshed_at: "x",
        },
      }),
    });
    expect(await ff.getBudget("ai_monthly_usd")).toBe(200);
    expect(await ff.getBudget("sms_monthly_pln")).toBeUndefined();
  });

  it("getFlag reads arbitrary value", async () => {
    const ff = createFeatureFlagClient({
      config: {
        clientId: "clk_1",
        tier: "starter",
        baseConfig: { flags: { ai_blog_enabled: false, custom_threshold: 42 } },
      },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl: mockFetch({ data: null }),
    });
    expect(await ff.getFlag("ai_blog_enabled")).toBe(false);
    expect(await ff.getFlag<number>("custom_threshold")).toBe(42);
    expect(await ff.getFlag("missing")).toBeUndefined();
  });

  it("KV cache stores resolved flags across calls", async () => {
    const kv = makeKv();
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(
        JSON.stringify({ data: { client_id: "clk_1", tier: "starter", modules: [], refreshed_at: "x" } }),
        { status: 200 },
      );
    }) as typeof fetch;

    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "starter", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      cacheKv: kv,
      fetchImpl,
    });

    await ff.resolve();
    await ff.resolve(); // cached
    await ff.resolve();
    expect(calls).toBe(1);
  });

  it("invalidate clears cache", async () => {
    const kv = makeKv();
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      return new Response(
        JSON.stringify({ data: { client_id: "clk_1", tier: "starter", modules: [], refreshed_at: "x" } }),
        { status: 200 },
      );
    }) as typeof fetch;

    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "starter", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      cacheKv: kv,
      fetchImpl,
    });

    await ff.resolve();
    await ff.invalidate();
    await ff.resolve();
    expect(calls).toBe(2);
  });

  it("concurrent resolve calls deduplicate", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return new Response(
        JSON.stringify({ data: { client_id: "clk_1", tier: "starter", modules: [], refreshed_at: "x" } }),
        { status: 200 },
      );
    }) as typeof fetch;

    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "starter", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      fetchImpl,
    });

    await Promise.all([ff.resolve(), ff.resolve(), ff.resolve()]);
    expect(calls).toBe(1);
  });

  it("integrates kill switches when killSwitchKv provided", async () => {
    const kv = makeKv();
    await kv.put("kill:AI_KILL_SWITCH", "true");

    const ff = createFeatureFlagClient({
      config: { clientId: "clk_1", tier: "premium", baseConfig: {} },
      hubBaseUrl: "https://hub.test",
      hubApiKey: "k",
      killSwitchKv: kv,
      fetchImpl: mockFetch({ data: null }),
    });
    const r = await ff.resolve();
    expect(r.killSwitches.has("AI_KILL_SWITCH")).toBe(true);
    expect(r.killSwitches.has("MAINTENANCE_MODE")).toBe(false);
  });
});
