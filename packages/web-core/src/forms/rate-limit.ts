/**
 * KV-based sliding-window rate limiter for form submits.
 *
 * Strategy: count-based bucket per (key, window). Cheap and good enough at our scale.
 * For higher precision use Durable Objects (overkill here).
 *
 * Keys:
 *   ip:<sha256(ip)>      — per source IP
 *   email:<email_hash>   — per email_hash (across IPs — protects against distributed attacks)
 *
 * Each KV entry: { count: number, window_started_at: ISO }
 * TTL: windowSec * 1.5 (auto-expire after window passes)
 */

import { sha256Hex } from "./pii.js";

export interface RateLimitInput {
  kv: KVNamespace;
  key: string; // pre-hashed or already-safe identifier
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  remaining: number;
  resetAtUnix: number;
}

interface BucketState {
  count: number;
  window_started_at: number; // unix seconds
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await input.kv.get(input.key);

  let state: BucketState;
  if (raw === null) {
    state = { count: 0, window_started_at: now };
  } else {
    try {
      state = JSON.parse(raw) as BucketState;
    } catch {
      state = { count: 0, window_started_at: now };
    }
    // Window rolled over → reset
    if (now - state.window_started_at >= input.windowSec) {
      state = { count: 0, window_started_at: now };
    }
  }

  const allowed = state.count < input.limit;
  const newCount = allowed ? state.count + 1 : state.count;
  const resetAtUnix = state.window_started_at + input.windowSec;

  // Always write (even when rejected) so we count attempts — caps abusers' KV traffic
  // (they pay for our KV ops, but capped by their own concurrency).
  await input.kv.put(
    input.key,
    JSON.stringify({ count: newCount, window_started_at: state.window_started_at }),
    { expirationTtl: Math.ceil(input.windowSec * 1.5) },
  );

  return {
    allowed,
    current: newCount,
    remaining: Math.max(0, input.limit - newCount),
    resetAtUnix,
  };
}

export interface CheckSubmitLimitsInput {
  kv: KVNamespace;
  clientId: string;
  ip: string;
  emailHash: string;
  /** Per-IP submit limit in window. Default 5. */
  submitsPerIp?: number;
  /** Per-email submit limit in window. Default 3. */
  submitsPerEmail?: number;
  /** Window seconds. Default 3600 (1h). */
  windowSec?: number;
}

export interface CheckSubmitLimitsResult {
  allowed: boolean;
  /** Which limit was hit, if any. */
  hit?: "ip" | "email";
  /** When the limit resets (unix seconds). */
  resetAtUnix?: number;
}

/**
 * Convenience: check both IP and email limits in one call.
 * Returns first denial — does NOT increment the second limit if first fails.
 */
export async function checkSubmitLimits(input: CheckSubmitLimitsInput): Promise<CheckSubmitLimitsResult> {
  const submitsPerIp = input.submitsPerIp ?? 5;
  const submitsPerEmail = input.submitsPerEmail ?? 3;
  const windowSec = input.windowSec ?? 3600;

  const ipHash = await sha256Hex(input.ip);
  const ipKey = `rl:${input.clientId}:ip:${ipHash}`;

  const ipResult = await checkRateLimit({
    kv: input.kv,
    key: ipKey,
    limit: submitsPerIp,
    windowSec,
  });
  if (!ipResult.allowed) {
    return { allowed: false, hit: "ip", resetAtUnix: ipResult.resetAtUnix };
  }

  const emailKey = `rl:${input.clientId}:email:${input.emailHash}`;
  const emailResult = await checkRateLimit({
    kv: input.kv,
    key: emailKey,
    limit: submitsPerEmail,
    windowSec,
  });
  if (!emailResult.allowed) {
    return { allowed: false, hit: "email", resetAtUnix: emailResult.resetAtUnix };
  }

  return { allowed: true };
}
