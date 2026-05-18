/**
 * Spoke → hub authentication middleware.
 *
 * Spoke sends `X-BP-Client-Key: ck_live_<random>`.
 * Hub looks up sha256(key) in D1 `clients.api_key_hash` (or `_new` during 7-day rotation).
 *
 * On success: sets `c.set('authenticatedClientId', clientId)`.
 * On failure: returns 401 immediately.
 */

import type { Context, MiddlewareHandler } from "hono";

import type { HonoEnv } from "../../env.js";
import { findClientByApiKeyHash } from "../../repos/clients.js";
import { sha256Hex } from "../lib/hash.js";
import { err } from "../lib/responses.js";

export const authClientKey: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const key = c.req.header("X-BP-Client-Key");
  if (!key) {
    return jsonError(c, 401, "AUTH_MISSING_KEY", "X-BP-Client-Key header required");
  }

  // Quick format sanity check before hashing
  if (key.length < 16 || key.length > 200) {
    return jsonError(c, 401, "AUTH_INVALID_KEY", "API key format invalid");
  }

  const hash = await sha256Hex(key);
  const client = await findClientByApiKeyHash(c.env.DB, hash);
  if (!client) {
    return jsonError(c, 401, "AUTH_INVALID_KEY", "API key not recognized");
  }
  if (client.status === "churned" || client.status === "suspended") {
    return jsonError(c, 401, "AUTH_REVOKED", "Klient account suspended");
  }

  c.set("authenticatedClientId", client.id);
  await next();
  return; // explicit
};

function jsonError(
  c: Context<HonoEnv>,
  status: 401,
  code: "AUTH_MISSING_KEY" | "AUTH_INVALID_KEY" | "AUTH_REVOKED",
  message: string,
): Response {
  return c.json(err(code, message), status);
}
