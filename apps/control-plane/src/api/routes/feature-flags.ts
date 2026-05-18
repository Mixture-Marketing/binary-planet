/**
 * GET /api/feature-flags
 *
 * Spoke polls hub for current modules + feature flags.
 * Cached client-side in KV for 5 min — spoke checks ETag for change detection.
 *
 * Auth: X-BP-Client-Key (authClientKey middleware).
 */

import { Hono } from "hono";

import type { HonoEnv } from "../../env.js";
import { findActiveClientById, parseFeatureFlags } from "../../repos/clients.js";
import { err, ok } from "../lib/responses.js";
import { sha256Hex } from "../lib/hash.js";

export const featureFlagsRouter = new Hono<HonoEnv>();

featureFlagsRouter.get("/", async (c) => {
  const clientId = c.get("authenticatedClientId");
  if (!clientId) {
    return c.json(err("AUTH_MISSING_KEY", "Authentication context missing"), 401);
  }

  const client = await findActiveClientById(c.env.DB, clientId);
  if (!client) {
    return c.json(err("NOT_FOUND", "Client not found or inactive"), 404);
  }

  const { modules, flags } = parseFeatureFlags(client);

  // ETag: hash of modules + flags JSON; spoke can skip update if matches
  const payload = {
    client_id: clientId,
    tier: client.tier,
    modules,
    flags,
    refreshed_at: new Date().toISOString(),
  };
  const etag = `"${(await sha256Hex(JSON.stringify({ modules, flags }))).slice(0, 16)}"`;

  // Honor If-None-Match for conditional GET
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private, max-age=300" },
    });
  }

  c.res.headers.set("ETag", etag);
  c.res.headers.set("Cache-Control", "private, max-age=300");
  return c.json(ok(payload));
});
