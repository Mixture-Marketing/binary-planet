/**
 * Lead input validation. Zod schema with Polish-specific defaults.
 *
 * Required fields: name, email, consent_processing=true.
 * Phone: optional in schema but UI usually requires it for service businesses.
 * Honeypot: hidden field; if filled, reject silently (bots fill all fields).
 */

import { z } from "zod";

import { normalizeEmail, normalizePhone } from "./pii.js";

/**
 * Pre-validation: accept "true"/"on"/"1" strings as truthy for consent checkboxes.
 * HTML forms send "on" for checked checkboxes; JSON APIs send true.
 */
function coerceBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    return ["true", "on", "1", "yes", "tak"].includes(v.toLowerCase());
  }
  if (typeof v === "number") return v !== 0;
  return false;
}

/**
 * Polish phone regex — permissive: accepts +48xxxxxxxxx, 48xxxxxxxxx, xxxxxxxxx (9 digits).
 * Normalization happens in normalizePhone() — this just guards.
 */
const polishPhoneRegex = /^(\+?48)?\s*\d{3}[\s-]?\d{3}[\s-]?\d{3}$/;

/**
 * Honeypot: if value is non-empty, almost certainly a bot.
 * Field name should be inconspicuous — e.g. "website" — and hidden via CSS.
 */
const honeypotSchema = z
  .string()
  .max(0, "honeypot tripped")
  .optional()
  .or(z.literal(""))
  .or(z.undefined());

export const leadInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Imię musi mieć co najmniej 2 znaki")
      .max(100, "Imię za długie"),

    email: z
      .string()
      .trim()
      .email("Nieprawidłowy adres e-mail")
      .max(200)
      .transform(normalizeEmail),

    phone: z
      .string()
      .trim()
      .regex(polishPhoneRegex, "Nieprawidłowy numer telefonu")
      .transform(normalizePhone)
      .optional()
      .or(z.literal("").transform(() => undefined)),

    message: z
      .string()
      .trim()
      .max(2000, "Wiadomość za długa (max 2000 znaków)")
      .optional()
      .or(z.literal("").transform(() => undefined)),

    service_interest: z.string().trim().max(100).optional(),
    source_page: z.string().trim().max(500).optional(),

    utm_source: z.string().trim().max(100).optional(),
    utm_medium: z.string().trim().max(100).optional(),
    utm_campaign: z.string().trim().max(100).optional(),

    estimated_value_pln: z.coerce.number().int().nonnegative().max(10_000_000).optional(),

    consent_processing: z
      .preprocess(coerceBool, z.boolean())
      .refine((v) => v === true, "Zgoda na przetwarzanie danych jest wymagana"),

    consent_marketing: z.preprocess(coerceBool, z.boolean()).default(false),

    consent_text_version: z.string().min(1).max(20),

    "cf-turnstile-response": z.string().min(1).max(2048).optional(),

    honeypot: honeypotSchema,
  })
  .strict();

export type LeadInputParsed = z.infer<typeof leadInputSchema>;

/**
 * Parse + validate. Returns Result type so caller can decide how to respond.
 */
export type ValidationResult =
  | { ok: true; data: LeadInputParsed }
  | { ok: false; errors: { path: string; message: string }[] };

export function validateLeadInput(raw: unknown): ValidationResult {
  const parsed = leadInputSchema.safeParse(raw);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    errors: parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  };
}
