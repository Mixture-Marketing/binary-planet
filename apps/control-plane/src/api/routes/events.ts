/**
 * POST /api/events — analytics events from spoke.
 *
 * Sample event types: 'spoke_deploy', 'cwv_metric', 'errors_5min'.
 * NOT for end-user analytics (those go to Plausible/Zaraz on the client side).
 *
 * v0.1: events written to audit_log table.
 * Faza 5+: migrate to Analytics Engine + Logpush for high-volume.
 *
 * Auth: X-BP-Client-Key (authClientKey middleware).
 */

import { Hono } from "hono";
import { z } from "zod";

import type { HonoEnv } from "../../env.js";
import { err, ok } from "../lib/responses.js";

export const eventsRouter = new Hono<HonoEnv>();

const eventSchema = z.object({
  event_type: z.string().min(1).max(64),
  severity: z.enum(["debug", "info", "warn", "error", "critical"]).default("info"),
  resource_type: z.string().max(64).optional(),
  resource_id: z.string().max(64).optional(),
  data: z.record(z.unknown()).optional(),
});

eventsRouter.post("/", async (c) => {
  const clientId = c.get("authenticatedClientId");
  if (!clientId) {
    return c.json(err("AUTH_MISSING_KEY", "Authentication context missing"), 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(err("VALIDATION_ERROR", "Invalid JSON body"), 400);
  }

  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json(
      err(
        "VALIDATION_ERROR",
        issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed",
      ),
      400,
    );
  }

  const action = `spoke.${parsed.data.event_type}`;
  const metadata = parsed.data.data ? JSON.stringify(parsed.data.data) : null;

  await c.env.DB.prepare(
    `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      `client:${clientId}`,
      action,
      parsed.data.resource_type ?? null,
      parsed.data.resource_id ?? null,
      clientId,
      parsed.data.severity,
      metadata,
    )
    .run();

  return c.json(ok({ accepted: true }), 202);
});
