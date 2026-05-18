/**
 * Request logging middleware. Attaches Logger to context, logs start + end.
 * Logger output → Workers console → Logpush → R2 parquet (per W.3.2).
 */

import { Logger, getRequestId } from "@mixturemarketing/logger";
import type { MiddlewareHandler } from "hono";

import type { HonoEnv } from "../../env.js";

export const requestLogger: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const requestId = getRequestId(c.req.raw.headers);
  const log = new Logger({
    requestId,
    module: "control-plane",
    workerName: "mm-control-plane",
  });
  c.set("requestId", requestId);
  c.set("logger", log);
  c.res.headers.set("X-Request-ID", requestId);

  const start = Date.now();
  log.info("request.start", {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
  });

  try {
    await next();
    log.info("request.end", {
      status: c.res.status,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    log.error(
      "request.error",
      err instanceof Error ? err : new Error(String(err)),
      { duration_ms: Date.now() - start },
    );
    throw err;
  }
};
