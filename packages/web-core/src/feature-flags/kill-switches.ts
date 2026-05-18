/**
 * Global kill switches — stored in CONFIG KV, checked frequently.
 *
 * Workflow:
 *   1. Admin / incident response sets KV key `kill:<NAME>` to "true"
 *   2. All spokes check at start of critical paths (forms, webhooks, AI calls)
 *   3. If active → return early with friendly user message + fallback path
 *
 * KV writes propagate eventually (~60s globally). For instant cutoff use hub
 * feature flag override (synchronous via /api/feature-flags poll).
 */

import type { KillSwitch } from "./types.js";

const KV_PREFIX = "kill";

export interface KillSwitchDeps {
  /** KV namespace for config (typically env.CONFIG in mm-control-plane or spoke). */
  kv: KVNamespace;
}

/**
 * Check if a kill switch is currently active.
 * Falsy values ("", null, missing) → inactive (false).
 */
export async function isKillSwitchActive(deps: KillSwitchDeps, name: KillSwitch): Promise<boolean> {
  const value = await deps.kv.get(`${KV_PREFIX}:${name}`);
  return value === "true" || value === "1";
}

/**
 * Set kill switch state. Use sparingly — affects ALL spokes globally.
 * Admin / runbook procedure only.
 */
export async function setKillSwitch(
  deps: KillSwitchDeps,
  name: KillSwitch,
  active: boolean,
  ttlSeconds?: number,
): Promise<void> {
  if (active) {
    const opts: { expirationTtl?: number } = {};
    if (ttlSeconds !== undefined) opts.expirationTtl = ttlSeconds;
    await deps.kv.put(`${KV_PREFIX}:${name}`, "true", opts);
  } else {
    await deps.kv.delete(`${KV_PREFIX}:${name}`);
  }
}

/**
 * Batch check — efficient when checking multiple switches in one request.
 * Returns Set of active switch names.
 */
export async function getActiveKillSwitches(
  deps: KillSwitchDeps,
  names: readonly KillSwitch[],
): Promise<Set<KillSwitch>> {
  const active = new Set<KillSwitch>();
  const results = await Promise.all(names.map(async (name) => ({ name, on: await isKillSwitchActive(deps, name) })));
  for (const r of results) {
    if (r.on) active.add(r.name);
  }
  return active;
}
