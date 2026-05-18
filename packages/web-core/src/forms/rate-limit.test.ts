import { describe, expect, it } from "vitest";

import { checkRateLimit, checkSubmitLimits } from "./rate-limit.js";

/**
 * Minimal in-memory KVNamespace shim for tests.
 * Implements only the methods our rate limiter uses.
 */
function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  const kv = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = "" }: { prefix?: string } = {}) {
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
  return kv as unknown as KVNamespace;
}

describe("checkRateLimit", () => {
  it("allows up to limit, blocks after", async () => {
    const kv = makeKv();
    const args = { kv, key: "test", limit: 3, windowSec: 3600 };

    const r1 = await checkRateLimit(args);
    expect(r1.allowed).toBe(true);
    expect(r1.current).toBe(1);

    const r2 = await checkRateLimit(args);
    expect(r2.allowed).toBe(true);
    expect(r2.current).toBe(2);

    const r3 = await checkRateLimit(args);
    expect(r3.allowed).toBe(true);
    expect(r3.current).toBe(3);

    const r4 = await checkRateLimit(args);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("isolates by key", async () => {
    const kv = makeKv();
    const r1 = await checkRateLimit({ kv, key: "a", limit: 1, windowSec: 3600 });
    const r2 = await checkRateLimit({ kv, key: "b", limit: 1, windowSec: 3600 });
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
  });
});

describe("checkSubmitLimits", () => {
  it("uses defaults (5/IP, 3/email)", async () => {
    const kv = makeKv();
    const args = { kv, clientId: "clk_a", ip: "1.2.3.4", emailHash: "h1" };

    // 3 submits — should succeed (under email limit of 3)
    for (let i = 0; i < 3; i++) {
      const r = await checkSubmitLimits(args);
      expect(r.allowed).toBe(true);
    }
    // 4th hits email limit (per-email limit is 3 default)
    const r = await checkSubmitLimits(args);
    expect(r.allowed).toBe(false);
    expect(r.hit).toBe("email");
  });

  it("IP limit blocks even with different emails", async () => {
    const kv = makeKv();
    // Custom: per-IP=2, per-email=10 — force IP to be the bottleneck
    const baseArgs = {
      kv,
      clientId: "clk_a",
      ip: "5.5.5.5",
      submitsPerIp: 2,
      submitsPerEmail: 10,
    };

    expect((await checkSubmitLimits({ ...baseArgs, emailHash: "e1" })).allowed).toBe(true);
    expect((await checkSubmitLimits({ ...baseArgs, emailHash: "e2" })).allowed).toBe(true);
    const blocked = await checkSubmitLimits({ ...baseArgs, emailHash: "e3" });
    expect(blocked.allowed).toBe(false);
    expect(blocked.hit).toBe("ip");
  });

  it("different klient = isolated buckets", async () => {
    const kv = makeKv();
    const args1 = { kv, clientId: "clk_a", ip: "1.1.1.1", emailHash: "h1", submitsPerIp: 1 };
    const args2 = { kv, clientId: "clk_b", ip: "1.1.1.1", emailHash: "h1", submitsPerIp: 1 };
    expect((await checkSubmitLimits(args1)).allowed).toBe(true);
    expect((await checkSubmitLimits(args2)).allowed).toBe(true);
    expect((await checkSubmitLimits(args1)).allowed).toBe(false);
  });
});
