/**
 * @mixturemarketing/web-core/forms
 *
 * Form handler for klient sites (spoke). Handles validation, anti-bot, rate limiting,
 * PII protection, hub sync, and fallback queue.
 *
 * Quick start:
 *   import { createFormHandler } from "@mixturemarketing/web-core/forms";
 *
 *   export default {
 *     async fetch(request, env) {
 *       const handler = createFormHandler({
 *         env,
 *         config: {
 *           clientId: "clk_abc",
 *           businessName: "Ślusarz Kowalski",
 *           notificationEmail: "kowalski@example.pl",
 *           primaryDomain: "kowalski-slusarz.pl",
 *           consentTextVersion: "v1.0",
 *         },
 *       });
 *       return handler(request);
 *     }
 *   };
 *
 * Reference:
 *  - plan/J-hub-spoke.md (J.4 failure modes — fallback queue rationale)
 *  - plan/A-rodo.md (A.2 consent)
 *  - plan/00-main.md "Faza 1, krytyczny plik #6" (web-core/forms scope)
 */

export const MODULE_NAME = "forms" as const;

// Main entry
export { createFormHandler, SUPPORTED_SOURCES } from "./handler.js";
export type { CreateFormHandlerInput, FormHandler } from "./handler.js";

// Types
export type {
  FormHandlerConfig,
  FormHandlerEnv,
  LeadSource,
  RawLeadInput,
  SubmitOutcome,
  TransportLead,
  ValidatedLead,
} from "./types.js";

// Validation
export { leadInputSchema, validateLeadInput } from "./validation.js";
export type { LeadInputParsed, ValidationResult } from "./validation.js";

// RODO consent
export {
  CURRENT_CONSENT_VERSION,
  isKnownConsentVersion,
  listConsentVersions,
  renderConsentText,
} from "./rodo.js";
export type { ConsentTemplateInput, ConsentTextOutput } from "./rodo.js";

// PII helpers (exposed for advanced use — e.g. server-side dedup queries)
export {
  decodeKey,
  decryptString,
  encryptString,
  generateKey,
  normalizeEmail,
  normalizePhone,
  sha256Hex,
  sha256HexSalted,
} from "./pii.js";

// Turnstile
export { TurnstileError, verifyTurnstileToken } from "./turnstile.js";
export type { TurnstileVerifyInput, TurnstileVerifyResult } from "./turnstile.js";

// Rate limit
export { checkRateLimit, checkSubmitLimits } from "./rate-limit.js";
export type {
  CheckSubmitLimitsInput,
  CheckSubmitLimitsResult,
  RateLimitInput,
  RateLimitResult,
} from "./rate-limit.js";

// Hub sync
export { HubSyncError, sendLeadToHub } from "./hub-sync.js";
export type { HubSyncDeps, HubSyncOptions, HubSyncResult } from "./hub-sync.js";

// Resend
export { forwardLeadToKlient } from "./resend.js";
export type { ForwardLeadInput, ResendDeps, ResendResult } from "./resend.js";

// SMSAPI.pl — SMS lead notification to klient
export { renderSmsBody, sendLeadSmsToKlient } from "./smsapi.js";
export type { SmsapiDeps, SmsLeadInput, SmsResult } from "./smsapi.js";

// Fallback queue
export { drainQueue, enqueueLead, MAX_QUEUE_RETRIES, queueDepth } from "./fallback-queue.js";
export type {
  DrainOptions,
  DrainResult,
  EnqueuedLead,
  FallbackQueueDeps,
} from "./fallback-queue.js";
