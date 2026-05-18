import { describe, expect, it } from "vitest";

import {
  getActiveKillSwitches,
  isKillSwitchActive,
  setKillSwitch,
} from "./kill-switches.js";

function makeKv(): KVNamespace {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kv: any = {
    async get(k: string) {
      const e = store.get(k);
      if (!e) return null;
      if (e.expiresAt && e.expiresAt < Date.now()) return null;
      return e.value;
    },
    async put(k: string, v: string, opts?: { expirationTtl?: number }) {
      const entry: { value: string; expiresAt?: number } = { value: v };
      if (opts?.expirationTtl) entry.expiresAt = Date.now() + opts.expirationTtl * 1000;
      store.set(k, entry);
    },
    async delete(k: string) {
      store.delete(k);
    },
    async list() {
      return { keys: [], list_complete: true, cacheStatus: null };
    },
  };
  return kv as KVNamespace;
}

describe("kill switches", () => {
  it("isKillSwitchActive false when not set", async () => {
    const kv = makeKv();
    expect(await isKillSwitchActive({ kv }, "MAINTENANCE_MODE")).toBe(false);
  });

  it("setKillSwitch(true) then check", async () => {
    const kv = makeKv();
    await setKillSwitch({ kv }, "AI_KILL_SWITCH", true);
    expect(await isKillSwitchActive({ kv }, "AI_KILL_SWITCH")).toBe(true);
    expect(await isKillSwitchActive({ kv }, "MAINTENANCE_MODE")).toBe(false);
  });

  it("setKillSwitch(false) deletes key", async () => {
    const kv = makeKv();
    await setKillSwitch({ kv }, "AI_KILL_SWITCH", true);
    await setKillSwitch({ kv }, "AI_KILL_SWITCH", false);
    expect(await isKillSwitchActive({ kv }, "AI_KILL_SWITCH")).toBe(false);
  });

  it("TTL respected", async () => {
    const kv = makeKv();
    await setKillSwitch({ kv }, "AI_KILL_SWITCH", true, 1);
    expect(await isKillSwitchActive({ kv }, "AI_KILL_SWITCH")).toBe(true);
    // sleep 1.1s
    await new Promise((r) => setTimeout(r, 1100));
    expect(await isKillSwitchActive({ kv }, "AI_KILL_SWITCH")).toBe(false);
  });

  it("getActiveKillSwitches batch returns set", async () => {
    const kv = makeKv();
    await setKillSwitch({ kv }, "MAINTENANCE_MODE", true);
    await setKillSwitch({ kv }, "AI_KILL_SWITCH", true);
    const active = await getActiveKillSwitches({ kv }, [
      "MAINTENANCE_MODE",
      "AI_KILL_SWITCH",
      "FORMS_KILL_SWITCH",
    ]);
    expect(active.has("MAINTENANCE_MODE")).toBe(true);
    expect(active.has("AI_KILL_SWITCH")).toBe(true);
    expect(active.has("FORMS_KILL_SWITCH")).toBe(false);
    expect(active.size).toBe(2);
  });

  it("accepts '1' as truthy too", async () => {
    const kv = makeKv();
    await kv.put("kill:MAINTENANCE_MODE", "1");
    expect(await isKillSwitchActive({ kv }, "MAINTENANCE_MODE")).toBe(true);
  });
});
