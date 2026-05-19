/**
 * POST /api/admin/preonboard — self-serve client creation from marketing landing.
 *
 * Marketing landing (mixturemarketing.pl/abonament) wywołuje ten endpoint po formularzu
 * "Wybierz pakiet → wpisz dane firmy" PRZED Stripe Checkout. Zwraca client_id którego
 * następnie używamy w POST /api/admin/stripe/checkout.
 *
 * Body:
 *   {
 *     business_name: string (1..200)
 *     email: string (email)
 *     phone: string (E.164 +48...)
 *     nip: string (10 digits)
 *     tier: "starter" | "standard" | "premium"
 *     consent_marketing?: boolean (default false)
 *     consent_processing: boolean (MUST be true — RODO Art. 6 lit. b)
 *     consent_text_version: string (np. "v1.0")
 *   }
 *
 * Response 200:
 *   { ok: true, data: { client_id: "clk_xxx", already_exists: boolean } }
 *
 * Auth: X-BP-Preonboard-Key header == env.PREONBOARD_PUBLIC_KEY.
 * To jest "public-ish" klucz (wstrzykiwany w build marketing landing) — bezpieczeństwo
 * przez rate limit (KV per IP, 5 prób/h).
 *
 * Idempotency: jeśli klient z tym email_hash już istnieje + status='pending' (jeszcze
 * nie zapłacił), zwracamy ten sam client_id zamiast tworzyć drugiego.
 *
 * Status klienta = 'pending'. Stripe webhook po opłacie flipnie na 'provisioning'.
 */

import { Hono } from "hono";
import { z } from "zod";

import type { HonoEnv } from "../../../env.js";
import { err, ok } from "../../lib/responses.js";

export const preonboardRouter = new Hono<HonoEnv>();

const NIP_REGEX = /^\d{10}$/;
const PHONE_E164 = /^\+\d{8,15}$/;

const preonboardSchema = z.object({
  business_name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().regex(PHONE_E164, "Phone must be E.164 format (+48...)"),
  nip: z.string().regex(NIP_REGEX, "NIP must be exactly 10 digits"),
  tier: z.enum(["starter", "standard", "premium"]),
  consent_marketing: z.boolean().optional().default(false),
  consent_processing: z.literal(true, { errorMap: () => ({ message: "consent_processing must be true (RODO)" }) }),
  consent_text_version: z.string().min(1).max(20),
});

const RATE_LIMIT_PREFIX = "preonboard_rl:";
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SEC = 3600;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function clientIdFromName(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `clk_${slug || "unnamed"}_${Math.random().toString(36).slice(2, 7)}`;
}

preonboardRouter.post("/", async (c) => {
  const env = c.env;

  if (!env.PREONBOARD_PUBLIC_KEY) {
    return c.json(err("AUTH_MISSING_KEY", "Preonboard endpoint disabled — set PREONBOARD_PUBLIC_KEY"), 403);
  }

  const provided = c.req.header("X-BP-Preonboard-Key");
  if (provided !== env.PREONBOARD_PUBLIC_KEY) {
    return c.json(err("AUTH_INVALID_KEY", "Invalid or missing X-BP-Preonboard-Key"), 401);
  }

  // Rate limit per IP (CF-Connecting-IP for prod, x-forwarded-for for dev)
  const ip = c.req.header("CF-Connecting-IP")
    ?? c.req.header("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "unknown";
  const rlKey = `${RATE_LIMIT_PREFIX}${await sha256Hex(ip)}`;
  const rlRaw = await env.CONFIG.get(rlKey);
  const rlCount = rlRaw ? Number.parseInt(rlRaw, 10) : 0;
  if (rlCount >= RATE_LIMIT_MAX) {
    return c.json(err("RATE_LIMITED", `Too many preonboard attempts (max ${RATE_LIMIT_MAX}/h per IP)`), 429);
  }
  await env.CONFIG.put(rlKey, String(rlCount + 1), { expirationTtl: RATE_LIMIT_WINDOW_SEC });

  // Parse + validate body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(err("VALIDATION_ERROR", "Body must be JSON"), 400);
  }

  const parsed = preonboardSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return c.json(err("VALIDATION_ERROR", `Validation failed: ${JSON.stringify(issues)}`), 422);
  }
  const payload = parsed.data;

  // Idempotency check — match by email_hash + status='pending'
  const emailHash = await sha256Hex(payload.email.toLowerCase().trim());
  const existing = await env.DB
    .prepare(
      `SELECT c.id, c.status FROM clients c
         JOIN client_contacts cc ON cc.client_id = c.id
        WHERE cc.contact_email_hash = ?
          AND c.status = 'pending'
        LIMIT 1`,
    )
    .bind(emailHash)
    .first<{ id: string; status: string }>();
  if (existing) {
    return c.json(ok({ client_id: existing.id, already_exists: true }), 200);
  }

  // Generate client_id + insert
  const clientId = clientIdFromName(payload.business_name);
  // v0.1: store email/phone as "dev:plaintext" prefix. Production Track 6b swaps in AES-GCM.
  const emailEnc = `dev:${payload.email}`;
  const phoneEnc = `dev:${payload.phone}`;
  const phoneHash = await sha256Hex(payload.phone);

  try {
    await env.DB
      .prepare(
        `INSERT INTO clients (
           id, business_name, nip, industry, subtype_schema, theme_preset,
           city, tier, status, feature_flags_json, modules_json
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '{}', '[]')`,
      )
      .bind(
        clientId,
        payload.business_name,
        payload.nip,
        "other",            // industry — to be set in onboarding wizard after payment
        "LocalBusiness",
        "craftsman",        // theme — to be customized in wizard
        "",                 // city — empty until wizard step
        payload.tier,
      )
      .run();

    await env.DB
      .prepare(
        `INSERT INTO client_contacts (
           client_id, contact_name, contact_email_enc, contact_email_hash,
           contact_phone_enc, contact_phone_hash
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        clientId,
        payload.business_name,  // contact_name = business_name placeholder (wizard refines)
        emailEnc,
        emailHash,
        phoneEnc,
        phoneHash,
      )
      .run();

    // Audit log + consent log
    await env.DB
      .prepare(
        `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
         VALUES ('visitor', 'preonboard.created', 'client', ?, ?, 'info', ?)`,
      )
      .bind(
        clientId,
        clientId,
        JSON.stringify({
          tier: payload.tier,
          consent_marketing: payload.consent_marketing,
          consent_text_version: payload.consent_text_version,
          ip_hash: await sha256Hex(ip),
        }),
      )
      .run();
  } catch (e) {
    const message = e instanceof Error ? e.message : "db insert failed";
    const log = c.get("logger");
    if (log) log.error("preonboard_insert_failed", e instanceof Error ? e : new Error(message), { client_id: clientId });
    return c.json(err("INTERNAL_ERROR", `Failed to create client: ${message}`), 500);
  }

  return c.json(ok({ client_id: clientId, already_exists: false }), 200);
});
