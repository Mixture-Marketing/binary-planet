/**
 * mm-control-plane — Worker entry point.
 *
 * Exports:
 *   - fetch(request, env, ctx)     — HTTP routing via Hono
 *   - scheduled(event, env, ctx)   — cron triggers → scheduled dispatcher
 *
 * Reference: plan/J-hub-spoke.md
 *
 * Type note: Hono uses global lib.dom Request/Response. Workers-types declares parallel
 * (incompatible) versions. We let inference fall through Hono — no explicit ExportedHandler
 * annotation — and cast scheduled handler's event narrowing where needed.
 */

import { createApp } from "./api/router.js";
import type { Env } from "./env.js";
import { runScheduled } from "./scheduled/index.js";

const app = createApp();

export default {
  fetch: app.fetch,

  scheduled(
    event: { cron: string; scheduledTime: number },
    env: Env,
    ctx: { waitUntil(promise: Promise<unknown>): void },
  ): void {
    ctx.waitUntil(runScheduled(event, env));
  },
};
