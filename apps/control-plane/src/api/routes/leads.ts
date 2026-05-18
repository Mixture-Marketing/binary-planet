/**
 * POST /api/leads — receive TransportLead from spokes.
 *
 * Auth: X-BP-Client-Key (authClientKey middleware).
 * Idempotent: (client_id, client_lead_id) is the natural dedup key.
 *
 * Spoke flow (web-core/forms):
 *   1. Spoke validates + builds TransportLead
 *   2. POST here with X-BP-Client-Key + X-Lead-Id (= client_lead_id for tracing)
 *   3. On 200: lead persisted in D1
 *   4. On 5xx: spoke enqueues to fallback queue, drain cron retries
 */

import { Hono } from "hono";
import { z } from "zod";

import type { HonoEnv } from "../../env.js";
import { insertLead } from "../../repos/leads.js";
import { err, ok } from "../lib/responses.js";

export const leadsRouter = new Hono<HonoEnv>();

// TransportLead schema — must match web-core/forms TransportLead shape.
// We re-declare here (with zod) because forms types are TS-only.
const transportLeadSchema = z.object({
  client_id: z.string().min(1).max(64),
  client_lead_id: z.string().regex(/^lead_[A-Za-z0-9]+$/),
  spoke_received_at: z.string().min(1).max(40),
  source: z.enum([
    "contact_form",
    "quote_form",
    "phone_click",
    "sms_click",
    "whatsapp_click",
    "email_click",
    "chatbot",
    "other",
  ]),
  source_page: z.string().max(500).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  service_interest: z.string().max(100).optional(),
  estimated_value_pln: z.number().int().nonnegative().max(10_000_000).optional(),
  visitor_id_hash: z.string().max(128).optional(),
  user_agent_family: z.string().max(40).optional(),
  country_code: z.string().regex(/^[A-Z]{2}$/).optional(),
  city: z.string().max(100).optional(),
  email_hash: z.string().regex(/^[0-9a-f]{64}$/),
  email_enc: z.string().max(2000).optional(),
  phone_hash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  phone_enc: z.string().max(500).optional(),
  name_enc: z.string().max(500).optional(),
  message_enc: z.string().max(5000).optional(),
  consent_processing: z.literal(1),
  consent_marketing: z.union([z.literal(0), z.literal(1)]),
  consent_text_version: z.string().min(1).max(20),
  consent_text_hash: z.string().max(128),
  consent_ip_hash: z.string().max(128).optional(),
  consent_at: z.string().min(1).max(40),
});

leadsRouter.post("/", async (c) => {
  const authClientId = c.get("authenticatedClientId");
  if (!authClientId) {
    return c.json(err("AUTH_MISSING_KEY", "Authentication context missing"), 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(err("VALIDATION_ERROR", "Invalid JSON body"), 400);
  }

  const parsed = transportLeadSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "validation failed";
    return c.json(err("VALIDATION_ERROR", message), 400);
  }

  // Authoritative check — spoke's `client_id` must match the authenticated key holder.
  // Prevents spoke A submitting leads under spoke B's identity if they somehow leak each other's lead IDs.
  if (parsed.data.client_id !== authClientId) {
    return c.json(err("VALIDATION_ERROR", "client_id does not match authenticated client"), 403);
  }

  const result = await insertLead(c.env.DB, parsed.data, authClientId);

  // 201 for fresh insert, 200 for duplicate (idempotent OK)
  const status = result.duplicate ? 200 : 201;
  return c.json(
    ok({ id: result.hubLeadId }, { duplicate: result.duplicate }),
    status,
  );
});
