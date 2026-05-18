/**
 * Form handler types. Runs in klient's Worker (spoke).
 *
 * Flow:
 *   POST /api/contact (klient site)
 *     → validate body (zod, RODO consent required)
 *     → Turnstile verify
 *     → rate limit (KV: per IP, per email)
 *     → hash PII (email, phone)
 *     → encrypt PII (if encryption key provided)
 *     → POST to hub (api.mixturemarketing.pl/api/leads) with BP_CLIENT_API_KEY
 *     → if hub fails: enqueue to KV fallback queue + send email to klient via Resend
 *     → if hub OK: response 200, klient gets email anyway (backup channel)
 *     → audit log to hub
 */

/**
 * Raw form submission payload (before validation).
 * Field names match what client-side <form> will send.
 */
export interface RawLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  service_interest?: string;
  source_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  estimated_value_pln?: number | string;

  // Consent
  consent_processing?: boolean | string;
  consent_marketing?: boolean | string;
  consent_text_version?: string;

  // Anti-spam
  "cf-turnstile-response"?: string;
  honeypot?: string;
}

/**
 * Validated, normalized lead. PII still plaintext at this stage —
 * pass to hashLeadPII()/encryptLeadPII() before persistence.
 */
export interface ValidatedLead {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  service_interest?: string;
  source_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  estimated_value_pln?: number;

  consent_processing: true; // refined: must be true after validation
  consent_marketing: boolean;
  consent_text_version: string;
  consent_text_hash: string;
}

/**
 * Lead ready for transport — PII hashed, optionally encrypted.
 * This is what gets POSTed to hub or stored in fallback queue.
 */
export interface TransportLead {
  // Non-PII metadata
  client_id: string;
  source: LeadSource;
  source_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  service_interest?: string;
  estimated_value_pln?: number;

  // Anonymous identifiers
  visitor_id_hash?: string;
  user_agent_family?: string;
  country_code?: string;
  city?: string;

  // PII (hashed + optionally encrypted)
  email_hash: string;
  email_enc?: string;
  phone_hash?: string;
  phone_enc?: string;
  name_enc?: string; // names not hashed (low cardinality, fingerprinting)
  message_enc?: string;

  // Consent evidence
  consent_processing: 1;
  consent_marketing: 0 | 1;
  consent_text_version: string;
  consent_text_hash: string;
  consent_ip_hash?: string;
  consent_at: string; // ISO timestamp

  // Spoke-generated correlation
  client_lead_id: string; // 'lead_<random>' generated in spoke
  spoke_received_at: string; // ISO
}

export type LeadSource =
  | "contact_form"
  | "quote_form"
  | "phone_click"
  | "sms_click"
  | "whatsapp_click"
  | "email_click"
  | "chatbot"
  | "other";

/**
 * Bindings the form handler needs from the Worker's `env`.
 * All optional except `RATE_LIMIT` and `FALLBACK_QUEUE` KV namespaces.
 */
export interface FormHandlerEnv {
  /** KV for rate limiting (per IP + per email_hash). */
  RATE_LIMIT: KVNamespace;
  /** KV for fallback queue (used when hub unreachable). */
  FALLBACK_QUEUE: KVNamespace;

  /** Turnstile secret (CF anti-bot). If undefined, Turnstile verification is skipped (dev only). */
  TURNSTILE_SECRET?: string;

  /** Hub-side BP client key (sha256(secret) === hub D1.api_key_hash). */
  BP_CLIENT_API_KEY?: string;

  /** Resend API key for forwarding leads to klient email. */
  RESEND_API_KEY?: string;
  /** "From" address for Resend emails — must match a verified domain. */
  RESEND_FROM?: string;

  /** Optional per-tenant PII encryption key (32 bytes base64). v0.1 may pass undefined → hash-only. */
  PII_ENCRYPTION_KEY_B64?: string;

  /** Hub base URL, default 'https://api.mixturemarketing.pl'. */
  HUB_BASE_URL?: string;
}

/**
 * Klient identity + per-deploy configuration.
 * Comes from client.config.ts in mm-starter — passed once at handler creation.
 */
export interface FormHandlerConfig {
  /** Klient ID (slug). Used for namespacing KV keys + included in TransportLead. */
  clientId: string;

  /** Klient's display name (used in emails). */
  businessName: string;

  /** Klient's email — where leads get forwarded by Resend backup. */
  notificationEmail: string;

  /** Klient's phone — included in auto-reply for accessibility. */
  contactPhone?: string;

  /** Klient's primary domain — used in CSP allowlist + email signatures. */
  primaryDomain: string;

  /** RODO consent text version to render — must match a builder in rodo.ts. */
  consentTextVersion: string;

  /** Rate limit overrides (defaults below). */
  rateLimit?: {
    /** Submits per IP per window. Default 5. */
    submitsPerIp?: number;
    /** Submits per email_hash per window. Default 3. */
    submitsPerEmail?: number;
    /** Window in seconds. Default 3600 (1h). */
    windowSec?: number;
  };

  /** Hub sync overrides. */
  hub?: {
    /** Timeout in ms before falling back to queue. Default 3000. */
    timeoutMs?: number;
    /** Retry attempts inline before fallback. Default 1. */
    maxRetries?: number;
  };

  /** Whether to send auto-reply to lead. Default false (often appears spammy for cold inquiries). */
  autoReplyToLead?: boolean;
}

/**
 * Result of submit. Returned from handler — also useful for tests.
 */
export interface SubmitOutcome {
  ok: boolean;
  /** What path was taken. */
  path: "hub_sync" | "fallback_queue" | "rejected";
  /** lead_<random> if accepted, undefined if rejected. */
  clientLeadId?: string;
  /** HTTP status to return to client. */
  status: number;
  /** Error code for client. NEVER expose internal details. */
  errorCode?:
    | "VALIDATION_ERROR"
    | "RATE_LIMITED"
    | "TURNSTILE_FAILED"
    | "HONEYPOT_TRIPPED"
    | "INTERNAL_ERROR";
  /** Human message in PL for end-user (safe to display). */
  userMessage?: string;
  /** Internal debug message (NEVER expose to klient end-user). */
  internalMessage?: string;
}
