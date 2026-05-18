/**
 * Feature flags client — runs in spoke Worker.
 *
 * Workflow:
 *   1. Spoke creates client with `clientId`, `tier`, `baseConfig` at cold start
 *   2. Calls `client.isModuleEnabled("ai_blog")` etc. throughout request lifecycle
 *   3. Client fetches hub /api/feature-flags lazily, caches 5 min in KV
 *   4. Merges: hub override > kill switches > base config > tier defaults
 *
 * Failure modes:
 *   - Hub timeout / error → fall back to baseConfig (don't block requests)
 *   - KV miss → fetch from hub
 *   - Kill switch fetch error → assume inactive (fail open, log warning)
 */

import { getActiveKillSwitches } from "./kill-switches.js";
import {
  KILL_SWITCHES,
  TIER_DEFAULT_MODULES,
  type BudgetCategory,
  type FeatureFlagsClientConfig,
  type HubFeatureFlagsResponse,
  type KillSwitch,
  type ModuleName,
  type ResolvedFlags,
} from "./types.js";

export interface FeatureFlagClientDeps {
  config: FeatureFlagsClientConfig;
  /** Hub base URL (e.g. "https://api.mixturemarketing.pl"). */
  hubBaseUrl: string;
  /** BP_CLIENT_API_KEY for spoke→hub auth. */
  hubApiKey: string;
  /** Optional KV namespace for 5-min cache. If absent, every call hits hub. */
  cacheKv?: KVNamespace;
  /** Optional KV namespace for kill switches. If absent, kill switches always inactive. */
  killSwitchKv?: KVNamespace;
  /** Override fetch for tests. */
  fetchImpl?: typeof fetch;
  /** Cache TTL seconds. Default 300 (5 min). */
  cacheTtlSec?: number;
}

const CACHE_KEY_PREFIX = "ff_cache";

export interface FeatureFlagClient {
  /** Resolve all flags. Cached 5 min in KV (per spoke instance). */
  resolve(): Promise<ResolvedFlags>;
  /** Convenience: is module enabled? */
  isModuleEnabled(module: ModuleName): Promise<boolean>;
  /** Convenience: get budget cap (or undefined). */
  getBudget(category: BudgetCategory): Promise<number | undefined>;
  /** Convenience: read arbitrary flag value. */
  getFlag<T = unknown>(key: string): Promise<T | undefined>;
  /** Force cache invalidation (used after admin override push). */
  invalidate(): Promise<void>;
}

export function createFeatureFlagClient(deps: FeatureFlagClientDeps): FeatureFlagClient {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const cacheTtl = deps.cacheTtlSec ?? 300;
  const cacheKey = `${CACHE_KEY_PREFIX}:${deps.config.clientId}`;

  let resolveInFlight: Promise<ResolvedFlags> | null = null;

  async function loadFromCache(): Promise<ResolvedFlags | null> {
    if (!deps.cacheKv) return null;
    const raw = await deps.cacheKv.get(cacheKey);
    if (!raw) return null;
    try {
      return deserializeResolved(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  async function saveToCache(flags: ResolvedFlags): Promise<void> {
    if (!deps.cacheKv) return;
    await deps.cacheKv.put(cacheKey, JSON.stringify(serializeResolved(flags)), {
      expirationTtl: cacheTtl,
    });
  }

  async function fetchHubFlags(): Promise<HubFeatureFlagsResponse | null> {
    try {
      const url = `${deps.hubBaseUrl.replace(/\/+$/, "")}/api/feature-flags`;
      const res = await fetchImpl(url, {
        method: "GET",
        headers: { "X-BP-Client-Key": deps.hubApiKey },
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: HubFeatureFlagsResponse };
      return body.data ?? null;
    } catch {
      return null;
    }
  }

  async function fetchKillSwitches(): Promise<Set<KillSwitch>> {
    if (!deps.killSwitchKv) return new Set();
    try {
      return await getActiveKillSwitches({ kv: deps.killSwitchKv }, KILL_SWITCHES);
    } catch {
      return new Set();
    }
  }

  async function doResolve(): Promise<ResolvedFlags> {
    // 1. Try cache
    const cached = await loadFromCache();
    if (cached) return cached;

    // 2. Merge sources
    const tierModules = TIER_DEFAULT_MODULES[deps.config.tier];
    const baseModules = deps.config.baseConfig.modules ?? [];

    const [hubFlags, killSwitches] = await Promise.all([fetchHubFlags(), fetchKillSwitches()]);

    const modules = new Set<ModuleName>([...tierModules, ...baseModules]);
    if (hubFlags?.modules) {
      for (const m of hubFlags.modules) modules.add(m);
    }

    const budgets: Partial<Record<BudgetCategory, number>> = {
      ...(deps.config.baseConfig.budgets ?? {}),
      ...(hubFlags?.budgets ?? {}),
    };

    const flags: Record<string, unknown> = {
      ...(deps.config.baseConfig.flags ?? {}),
      ...(hubFlags?.flags ?? {}),
    };

    const resolved: ResolvedFlags = {
      modules,
      budgets,
      flags,
      killSwitches,
      resolvedAt: new Date().toISOString(),
    };

    await saveToCache(resolved);
    return resolved;
  }

  return {
    async resolve(): Promise<ResolvedFlags> {
      // Deduplicate concurrent calls
      if (resolveInFlight) return resolveInFlight;
      resolveInFlight = doResolve().finally(() => {
        resolveInFlight = null;
      });
      return resolveInFlight;
    },

    async isModuleEnabled(module: ModuleName): Promise<boolean> {
      const flags = await this.resolve();
      return flags.modules.has(module);
    },

    async getBudget(category: BudgetCategory): Promise<number | undefined> {
      const flags = await this.resolve();
      return flags.budgets[category];
    },

    async getFlag<T = unknown>(key: string): Promise<T | undefined> {
      const flags = await this.resolve();
      return flags.flags[key] as T | undefined;
    },

    async invalidate(): Promise<void> {
      if (deps.cacheKv) {
        await deps.cacheKv.delete(cacheKey);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Serialization helpers (KV stores strings only)
// ---------------------------------------------------------------------------

function serializeResolved(flags: ResolvedFlags): Record<string, unknown> {
  return {
    modules: [...flags.modules],
    budgets: flags.budgets,
    flags: flags.flags,
    killSwitches: [...flags.killSwitches],
    resolvedAt: flags.resolvedAt,
  };
}

function deserializeResolved(obj: unknown): ResolvedFlags {
  const o = obj as Record<string, unknown>;
  return {
    modules: new Set((o["modules"] as ModuleName[] | undefined) ?? []),
    budgets: (o["budgets"] as Partial<Record<BudgetCategory, number>>) ?? {},
    flags: (o["flags"] as Record<string, unknown>) ?? {},
    killSwitches: new Set((o["killSwitches"] as KillSwitch[] | undefined) ?? []),
    resolvedAt: (o["resolvedAt"] as string) ?? new Date().toISOString(),
  };
}
