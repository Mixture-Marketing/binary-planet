/**
 * Form handler orchestrator. createFormHandler() returns a `(request: Request) => Promise<Response>`
 * suitable for use as Worker fetch handler OR Hono route.
 *
 * Pipeline:
 *   1. Parse body (JSON or formdata)
 *   2. Validate (zod) — reject on validation error
 *   3. Honeypot check — reject silently if tripped (return 200 to bot)
 *   4. Rate limit (KV per IP + email_hash) — reject 429 if over
 *   5. Turnstile verify — reject 403 if failed (if secret configured)
 *   6. Render consent text + check hash matches what user saw
 *   7. Build TransportLead (hash PII, optionally encrypt)
 *   8. Try hub sync (3s timeout, 1 retry)
 *   9. If hub fails → enqueue to fallback KV
 *  10. ALWAYS send Resend email to klient (parallel with hub, non-blocking)
 *  11. Return 200 to user with friendly message
 */

import { enqueueLead } from "./fallback-queue.js";
import { sendLeadToHub } from "./hub-sync.js";
import { decodeKey, encryptString, normalizeEmail, sha256Hex } from "./pii.js";
import { checkSubmitLimits } from "./rate-limit.js";
import { forwardLeadToKlient } from "./resend.js";
import { renderConsentText } from "./rodo.js";
import { verifyTurnstileToken } from "./turnstile.js";
import { validateLeadInput } from "./validation.js";
import type {
  FormHandlerConfig,
  FormHandlerEnv,
  LeadSource,
  SubmitOutcome,
  TransportLead,
  ValidatedLead,
} from "./types.js";

const SUPPORTED_SOURCES: readonly LeadSource[] = [
  "contact_form",
  "quote_form",
  "chatbot",
  "other",
];

export interface CreateFormHandlerInput {
  env: FormHandlerEnv;
  config: FormHandlerConfig;
  /** Override `Date.now`/UUID for tests. */
  clock?: () => Date;
  randomId?: () => string;
  /** Override fetch globally (passed to Turnstile/Resend/Hub). */
  fetchImpl?: typeof fetch;
}

export type FormHandler = (request: Request) => Promise<Response>;

/**
 * Create a request handler. Resulting function is stateless beyond what's stored in env.KV.
 * Safe to register as a singleton — instantiate once at module load.
 */
export function createFormHandler(input: CreateFormHandlerInput): FormHandler {
  const { env, config } = input;
  const clock = input.clock ?? (() => new Date());
  const randomId = input.randomId ?? defaultRandomId;
  const fetchImpl = input.fetchImpl ?? fetch;

  // Decode encryption key once (cold start cost) if provided
  let encryptionKeyPromise: Promise<CryptoKey> | undefined;
  if (env.PII_ENCRYPTION_KEY_B64) {
    encryptionKeyPromise = decodeKey(env.PII_ENCRYPTION_KEY_B64);
  }

  return async function handler(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, errorCode: "INVALID_METHOD" }, 405);
    }

    const outcome = await processSubmit(request, {
      env,
      config,
      clock,
      randomId,
      fetchImpl,
      encryptionKeyPromise,
    });
    return outcomeToResponse(outcome);
  };
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

interface ProcessDeps {
  env: FormHandlerEnv;
  config: FormHandlerConfig;
  clock: () => Date;
  randomId: () => string;
  fetchImpl: typeof fetch;
  encryptionKeyPromise: Promise<CryptoKey> | undefined;
}

async function processSubmit(request: Request, deps: ProcessDeps): Promise<SubmitOutcome> {
  // 1. Parse body
  const body = await parseBody(request);
  if (body === null) {
    return {
      ok: false,
      path: "rejected",
      status: 400,
      errorCode: "VALIDATION_ERROR",
      userMessage: "Nie udało się odczytać formularza. Spróbuj ponownie.",
      internalMessage: "body parse failed",
    };
  }

  // 2. Validate
  const parsed = validateLeadInput(body);
  if (!parsed.ok) {
    return {
      ok: false,
      path: "rejected",
      status: 400,
      errorCode: "VALIDATION_ERROR",
      userMessage: parsed.errors[0]?.message ?? "Sprawdź poprawność danych w formularzu.",
      internalMessage: `validation: ${parsed.errors.map((e) => `${e.path}=${e.message}`).join("; ")}`,
    };
  }

  // 3. Honeypot
  // (zod validation already enforces empty/undefined, but defense-in-depth)
  if (parsed.data.honeypot && parsed.data.honeypot.length > 0) {
    // Bot — return 200 to not signal detection.
    return {
      ok: true,
      path: "rejected",
      status: 200,
      errorCode: "HONEYPOT_TRIPPED",
      userMessage: "Dziękujemy! Wiadomość została wysłana.",
      internalMessage: "honeypot tripped",
    };
  }

  // Derive identifiers
  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";
  const emailHash = await sha256Hex(parsed.data.email);

  // 4. Rate limit
  const rl = await checkSubmitLimits({
    kv: deps.env.RATE_LIMIT,
    clientId: deps.config.clientId,
    ip,
    emailHash,
    ...(deps.config.rateLimit?.submitsPerIp !== undefined && {
      submitsPerIp: deps.config.rateLimit.submitsPerIp,
    }),
    ...(deps.config.rateLimit?.submitsPerEmail !== undefined && {
      submitsPerEmail: deps.config.rateLimit.submitsPerEmail,
    }),
    ...(deps.config.rateLimit?.windowSec !== undefined && {
      windowSec: deps.config.rateLimit.windowSec,
    }),
  });

  if (!rl.allowed) {
    return {
      ok: false,
      path: "rejected",
      status: 429,
      errorCode: "RATE_LIMITED",
      userMessage:
        "Wykryto zbyt wiele zgłoszeń. Spróbuj ponownie za chwilę.",
      internalMessage: `rate limit hit: ${rl.hit ?? "unknown"}`,
    };
  }

  // 5. Turnstile (if configured)
  if (deps.env.TURNSTILE_SECRET && parsed.data["cf-turnstile-response"]) {
    const ts = await verifyTurnstileToken({
      secret: deps.env.TURNSTILE_SECRET,
      token: parsed.data["cf-turnstile-response"],
      remoteIp: ip === "unknown" ? "" : ip,
      idempotencyKey: deps.randomId(),
      fetchImpl: deps.fetchImpl,
    }).catch(() => ({ success: false }));

    if (!ts.success) {
      return {
        ok: false,
        path: "rejected",
        status: 403,
        errorCode: "TURNSTILE_FAILED",
        userMessage: "Weryfikacja antybot nie powiodła się. Odśwież stronę i spróbuj ponownie.",
        internalMessage: "turnstile failed",
      };
    }
  } else if (deps.env.TURNSTILE_SECRET && !parsed.data["cf-turnstile-response"]) {
    return {
      ok: false,
      path: "rejected",
      status: 400,
      errorCode: "TURNSTILE_FAILED",
      userMessage: "Brak weryfikacji antybot.",
      internalMessage: "turnstile token missing",
    };
  }

  // 6. Render consent text + verify hash
  const consent = await renderConsentText(parsed.data.consent_text_version, {
    businessName: deps.config.businessName,
    primaryDomain: deps.config.primaryDomain,
    showMarketing: parsed.data.consent_marketing,
  });

  // 7. Build validated lead
  const validated: ValidatedLead = {
    name: parsed.data.name,
    email: normalizeEmail(parsed.data.email),
    consent_processing: true,
    consent_marketing: parsed.data.consent_marketing,
    consent_text_version: parsed.data.consent_text_version,
    consent_text_hash: consent.hash,
  };
  if (parsed.data.phone) validated.phone = parsed.data.phone;
  if (parsed.data.message) validated.message = parsed.data.message;
  if (parsed.data.service_interest) validated.service_interest = parsed.data.service_interest;
  if (parsed.data.source_page) validated.source_page = parsed.data.source_page;
  if (parsed.data.utm_source) validated.utm_source = parsed.data.utm_source;
  if (parsed.data.utm_medium) validated.utm_medium = parsed.data.utm_medium;
  if (parsed.data.utm_campaign) validated.utm_campaign = parsed.data.utm_campaign;
  if (parsed.data.estimated_value_pln !== undefined) {
    validated.estimated_value_pln = parsed.data.estimated_value_pln;
  }

  // 8. Build transport lead (hash + optionally encrypt)
  const clientLeadId = `lead_${deps.randomId()}`;
  const nowIso = deps.clock().toISOString();
  const encryptionKey = deps.encryptionKeyPromise ? await deps.encryptionKeyPromise : undefined;

  const transport = await buildTransportLead({
    clientId: deps.config.clientId,
    clientLeadId,
    nowIso,
    validated,
    emailHash,
    ip,
    request,
    encryptionKey,
  });

  // 9. Send to hub + forward email to klient — IN PARALLEL
  const hubBaseUrl = deps.env.HUB_BASE_URL ?? "https://api.mixturemarketing.pl";

  const hubPromise = deps.env.BP_CLIENT_API_KEY
    ? sendLeadToHub(
        {
          hubBaseUrl,
          apiKey: deps.env.BP_CLIENT_API_KEY,
          fetchImpl: deps.fetchImpl,
        },
        transport,
        {
          ...(deps.config.hub?.timeoutMs !== undefined && { timeoutMs: deps.config.hub.timeoutMs }),
          ...(deps.config.hub?.maxRetries !== undefined && { maxRetries: deps.config.hub.maxRetries }),
        },
      )
    : Promise.resolve({ ok: false, error: "no api key", isRetriable: true });

  const emailPromise =
    deps.env.RESEND_API_KEY && deps.env.RESEND_FROM
      ? forwardLeadToKlient(
          {
            apiKey: deps.env.RESEND_API_KEY,
            from: deps.env.RESEND_FROM,
            fetchImpl: deps.fetchImpl,
          },
          {
            toEmail: deps.config.notificationEmail,
            businessName: deps.config.businessName,
            lead: validated,
            clientLeadId,
            submittedAt: nowIso,
            ...(validated.source_page !== undefined && { sourcePage: validated.source_page }),
          },
        )
      : Promise.resolve({ ok: false, error: "resend not configured" });

  const [hubResult, emailResult] = await Promise.all([hubPromise, emailPromise]);

  // 10. If hub failed retriably → enqueue to fallback (klient already got email)
  if (!hubResult.ok && hubResult.isRetriable !== false) {
    await enqueueLead({ kv: deps.env.FALLBACK_QUEUE }, transport, "high");
    return {
      ok: true,
      path: "fallback_queue",
      status: 200,
      clientLeadId,
      userMessage: emailResult.ok
        ? "Dziękujemy! Wiadomość została wysłana — odpowiedź wkrótce."
        : "Dziękujemy! Wiadomość została zapisana — odezwiemy się wkrótce.",
      internalMessage: `hub fallback: ${hubResult.error ?? "unknown"}; email_ok=${emailResult.ok}`,
    };
  }

  // 11. Hub OK (or non-retriable error which means it was rejected; we accept anyway since email was sent)
  return {
    ok: true,
    path: "hub_sync",
    status: 200,
    clientLeadId,
    userMessage: "Dziękujemy! Wiadomość została wysłana — odezwiemy się wkrótce.",
    ...(hubResult.error !== undefined && {
      internalMessage: `hub_ok=${hubResult.ok}; email_ok=${emailResult.ok}; hub_err=${hubResult.error}`,
    }),
  };
}

interface BuildTransportInput {
  clientId: string;
  clientLeadId: string;
  nowIso: string;
  validated: ValidatedLead;
  emailHash: string;
  ip: string;
  request: Request;
  encryptionKey: CryptoKey | undefined;
}

async function buildTransportLead(input: BuildTransportInput): Promise<TransportLead> {
  const phoneHash = input.validated.phone ? await sha256Hex(input.validated.phone) : undefined;
  const ipHash = input.ip !== "unknown" ? await sha256Hex(input.ip) : undefined;

  const out: TransportLead = {
    client_id: input.clientId,
    client_lead_id: input.clientLeadId,
    spoke_received_at: input.nowIso,
    source: "contact_form",
    email_hash: input.emailHash,
    consent_processing: 1,
    consent_marketing: input.validated.consent_marketing ? 1 : 0,
    consent_text_version: input.validated.consent_text_version,
    consent_text_hash: input.validated.consent_text_hash,
    consent_at: input.nowIso,
  };

  if (phoneHash !== undefined) out.phone_hash = phoneHash;
  if (ipHash !== undefined) out.consent_ip_hash = ipHash;

  // Encrypt PII if key available
  if (input.encryptionKey) {
    out.name_enc = await encryptString(input.validated.name, input.encryptionKey);
    out.email_enc = await encryptString(input.validated.email, input.encryptionKey);
    if (input.validated.phone) {
      out.phone_enc = await encryptString(input.validated.phone, input.encryptionKey);
    }
    if (input.validated.message) {
      out.message_enc = await encryptString(input.validated.message, input.encryptionKey);
    }
  }

  // Non-PII metadata
  if (input.validated.source_page !== undefined) out.source_page = input.validated.source_page;
  if (input.validated.utm_source !== undefined) out.utm_source = input.validated.utm_source;
  if (input.validated.utm_medium !== undefined) out.utm_medium = input.validated.utm_medium;
  if (input.validated.utm_campaign !== undefined) out.utm_campaign = input.validated.utm_campaign;
  if (input.validated.service_interest !== undefined) out.service_interest = input.validated.service_interest;
  if (input.validated.estimated_value_pln !== undefined) {
    out.estimated_value_pln = input.validated.estimated_value_pln;
  }

  // Visitor + geo (cheap CF headers)
  const country = input.request.headers.get("CF-IPCountry");
  if (country) out.country_code = country;

  const ua = input.request.headers.get("User-Agent");
  if (ua) {
    out.user_agent_family = extractUaFamily(ua);
  }

  return out;
}

async function parseBody(request: Request): Promise<unknown> {
  const ct = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  try {
    if (ct.includes("application/json")) {
      return await request.json();
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      const fd = await request.formData();
      const obj: Record<string, FormDataEntryValue> = {};
      for (const [k, v] of fd.entries()) obj[k] = v;
      return obj;
    }
    // Fallback: try JSON
    return await request.json();
  } catch {
    return null;
  }
}

function extractUaFamily(ua: string): string {
  if (/firefox/i.test(ua)) return "Firefox";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/opera|opr/i.test(ua)) return "Opera";
  if (/bot|crawler|spider/i.test(ua)) return "Bot";
  return "Other";
}

function defaultRandomId(): string {
  // 12 chars base36 — plenty unique for per-spoke client_lead_id
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

function outcomeToResponse(outcome: SubmitOutcome): Response {
  // Public body — NEVER include internalMessage
  const body: Record<string, unknown> = {
    ok: outcome.ok,
  };
  if (outcome.userMessage) body.message = outcome.userMessage;
  if (outcome.clientLeadId) body.lead_id = outcome.clientLeadId;
  if (!outcome.ok && outcome.errorCode) body.error = outcome.errorCode;

  return jsonResponse(body, outcome.status);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Re-export source enum for tests
export { SUPPORTED_SOURCES };
