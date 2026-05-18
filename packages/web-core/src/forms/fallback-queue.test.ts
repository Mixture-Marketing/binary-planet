import { describe, expect, it } from "vitest";

import { drainQueue, enqueueLead, MAX_QUEUE_RETRIES, queueDepth } from "./fallback-queue.js";
import type { TransportLead } from "./types.js";

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
    async list({ prefix = "", limit = 1000 }: { prefix?: string; limit?: number } = {}) {
      const keys = Array.from(store.keys())
        .filter((k) => k.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
  };
  return kv as unknown as KVNamespace;
}

function mkLead(suffix: string, opts: { client?: string; ts?: string } = {}): TransportLead {
  return {
    client_id: opts.client ?? "clk_a",
    client_lead_id: `lead_${suffix}`,
    spoke_received_at: opts.ts ?? `2026-05-18T12:00:${suffix.padStart(2, "0")}Z`,
    source: "contact_form",
    email_hash: "hash",
    consent_processing: 1,
    consent_marketing: 0,
    consent_text_version: "v1.0",
    consent_text_hash: "h",
    consent_at: "2026-05-18T12:00:00Z",
  };
}

describe("fallback queue", () => {
  it("enqueue + queueDepth", async () => {
    const kv = makeKv();
    await enqueueLead({ kv }, mkLead("01"));
    await enqueueLead({ kv }, mkLead("02"));
    expect(await queueDepth({ kv }, "clk_a")).toBe(2);
  });

  it("drainQueue success deletes entry", async () => {
    const kv = makeKv();
    await enqueueLead({ kv }, mkLead("01"));
    const r = await drainQueue(
      { kv },
      {
        clientId: "clk_a",
        sendToHub: async () => ({ ok: true }),
      },
    );
    expect(r.succeeded).toBe(1);
    expect(r.attempted).toBe(1);
    expect(await queueDepth({ kv }, "clk_a")).toBe(0);
  });

  it("drainQueue failure increments retry count, keeps entry", async () => {
    const kv = makeKv();
    await enqueueLead({ kv }, mkLead("01"));
    const r = await drainQueue(
      { kv },
      {
        clientId: "clk_a",
        sendToHub: async () => ({ ok: false, error: "boom" }),
      },
    );
    expect(r.failed).toBe(1);
    expect(r.succeeded).toBe(0);
    expect(await queueDepth({ kv }, "clk_a")).toBe(1);
  });

  it("isolates by clientId", async () => {
    const kv = makeKv();
    await enqueueLead({ kv }, mkLead("01", { client: "clk_a" }));
    await enqueueLead({ kv }, mkLead("02", { client: "clk_b" }));

    const drained = await drainQueue(
      { kv },
      {
        clientId: "clk_a",
        sendToHub: async () => ({ ok: true }),
      },
    );
    expect(drained.succeeded).toBe(1);
    expect(await queueDepth({ kv }, "clk_a")).toBe(0);
    expect(await queueDepth({ kv }, "clk_b")).toBe(1);
  });

  it("MAX_QUEUE_RETRIES sane upper bound", () => {
    expect(MAX_QUEUE_RETRIES).toBeGreaterThan(0);
    expect(MAX_QUEUE_RETRIES).toBeLessThan(10000);
  });
});
