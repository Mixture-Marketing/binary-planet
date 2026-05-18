/**
 * Global error handler. Catches uncaught exceptions and returns sanitized 500.
 * Use as Hono.onError handler — see router.ts.
 */

import type { Context } from "hono";

import type { HonoEnv } from "../../env.js";
import { err } from "../lib/responses.js";

export function onError(error: Error, c: Context<HonoEnv>): Response {
  // Hono-native HTTPException — return its status + JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const honoException = error as any;
  if (honoException && typeof honoException.getResponse === "function") {
    return honoException.getResponse() as Response;
  }

  const log = c.get("logger");
  if (log) {
    log.error("unhandled_error", error);
  }

  // Never leak internal stack to caller
  return c.json(err("INTERNAL_ERROR", "Wystąpił błąd serwera. Spróbuj ponownie."), 500);
}

export function notFoundHandler(c: Context<HonoEnv>): Response {
  return c.json(err("NOT_FOUND", "Nie znaleziono zasobu."), 404);
}
