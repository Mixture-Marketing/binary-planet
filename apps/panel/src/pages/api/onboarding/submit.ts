/**
 * POST /api/onboarding/submit — klient finalizes onboarding wizard.
 *
 * Body: full ClientConfig shape (matches apps/starter/src/client.config.schema.ts).
 * Auth: panel session cookie (klient must be logged in via magic link).
 *
 * Effect:
 *   1. UPSERT client_provisioning_configs.config_json
 *   2. Mark client_provisioning_configs.provisioning_status = 'pending'
 *      (Track 4 cron will pick it up; currently DRY-RUN so just logs steps)
 *   3. UPDATE clients with refined fields (city, industry, theme_preset, primary_domain)
 *
 * Returns: { ok: true, client_id, next: "/onboarding/complete" }
 */

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

interface OnboardingPayload {
  // Step 1: Firma
  legal_name?: string;
  regon?: string;
  industry: string;
  schema_type: string;
  founded_year?: number;
  employee_count?: number;
  description: string;
  tagline: string;
  long_description: string;

  // Step 2: Domena
  primary_domain: string;
  domain_source: "owned" | "register";

  // Step 3: Lokalizacja
  street_address: string;
  city: string;
  voivodeship: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  service_area: string[];

  // Step 4: Kontakt
  secondary_phone?: string;
  contact_person_name?: string;

  // Step 5: Usługi
  services: Array<{ slug: string; name: string; description: string; price_from?: string; icon_key?: string }>;

  // Step 6: Godziny
  hours: Partial<Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", string>> & { note?: string };

  // Step 7: Theme
  theme_preset: "minimalist" | "elegant" | "dynamic" | "editorial";
  theme_variant?: string;
  theme_hero?: "centered" | "split" | "image-bg" | "asymmetric";
  theme_accent?: "bold" | "soft" | "outline";
  theme_sections?: Array<{ kind: string; enabled: boolean }>;

  // Step 8: Integracje
  plausible?: boolean;
  zaraz?: boolean;
  ga4_id?: string;
  meta_pixel?: string;

  // Step 9: Opinie (opcjonalne)
  reviews?: Array<{ author: string; rating: number; date: string; text: string; source?: string }>;

  // Step 10: RODO
  consent_version: string;
  privacy_policy_url?: string;
  terms_url?: string;
  dpa_signed: boolean;
}

interface ValidationError {
  field: string;
  message: string;
}

function validate(p: OnboardingPayload): ValidationError[] {
  const errors: ValidationError[] = [];
  const required = (v: unknown, field: string, label: string) => {
    if (typeof v !== "string" || v.trim().length === 0) errors.push({ field, message: `${label} jest wymagane` });
  };

  required(p.industry, "industry", "Branża");
  required(p.description, "description", "Opis firmy");
  required(p.tagline, "tagline", "Tagline");
  required(p.long_description, "long_description", "Długi opis");
  required(p.primary_domain, "primary_domain", "Domena");
  required(p.street_address, "street_address", "Ulica");
  required(p.city, "city", "Miasto");
  required(p.voivodeship, "voivodeship", "Województwo");
  required(p.postal_code, "postal_code", "Kod pocztowy");
  required(p.theme_preset, "theme_preset", "Theme");

  if (!/^\d{2}-\d{3}$/.test(p.postal_code ?? "")) {
    errors.push({ field: "postal_code", message: "Kod pocztowy w formacie NN-NNN" });
  }
  if (!p.primary_domain?.match(/^[a-z0-9.-]+\.[a-z]{2,}$/)) {
    errors.push({ field: "primary_domain", message: "Domena w formacie np. kowalski-slusarz.pl" });
  }
  if (!Array.isArray(p.services) || p.services.length === 0) {
    errors.push({ field: "services", message: "Dodaj przynajmniej jedną usługę" });
  }
  if (p.services?.length > 8) {
    errors.push({ field: "services", message: "Maksymalnie 8 usług" });
  }
  if (!Array.isArray(p.service_area) || p.service_area.length === 0) {
    errors.push({ field: "service_area", message: "Wpisz co najmniej jedno miasto obsługi" });
  }
  if (!p.dpa_signed) {
    errors.push({ field: "dpa_signed", message: "Akceptacja DPA wymagana" });
  }

  return errors;
}

function parseHours(s?: string): [string, string] | "closed" | undefined {
  if (!s) return undefined;
  if (s === "closed") return "closed";
  const m = s.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!m) return undefined;
  return [m[1]!, m[2]!];
}

function buildClientConfig(p: OnboardingPayload, clientId: string, businessName: string, nip: string, phone: string, email: string): Record<string, unknown> {
  return {
    clientId,
    business: {
      name: businessName,
      ...(p.legal_name && { legalName: p.legal_name }),
      nip,
      ...(p.regon && { regon: p.regon }),
      industry: p.industry,
      schemaType: p.schema_type,
      ...(p.founded_year && { foundedYear: p.founded_year }),
      ...(p.employee_count && { employeeCount: p.employee_count }),
      description: p.description,
      tagline: p.tagline,
      longDescription: p.long_description,
    },
    contact: {
      primaryPhone: phone,
      ...(p.secondary_phone && { secondaryPhone: p.secondary_phone }),
      email,
      ...(p.contact_person_name && { contactPersonName: p.contact_person_name }),
    },
    location: {
      address: {
        streetAddress: p.street_address,
        city: p.city,
        voivodeship: p.voivodeship,
        postalCode: p.postal_code,
        country: "PL",
      },
      ...(p.latitude !== undefined && p.longitude !== undefined && {
        geo: { latitude: p.latitude, longitude: p.longitude },
      }),
      serviceArea: p.service_area,
    },
    services: p.services.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      ...(s.price_from && { priceFrom: s.price_from }),
      ...(s.icon_key && { iconKey: s.icon_key }),
    })),
    hours: {
      ...(parseHours(p.hours?.monday) !== undefined && { monday: parseHours(p.hours.monday) }),
      ...(parseHours(p.hours?.tuesday) !== undefined && { tuesday: parseHours(p.hours.tuesday) }),
      ...(parseHours(p.hours?.wednesday) !== undefined && { wednesday: parseHours(p.hours.wednesday) }),
      ...(parseHours(p.hours?.thursday) !== undefined && { thursday: parseHours(p.hours.thursday) }),
      ...(parseHours(p.hours?.friday) !== undefined && { friday: parseHours(p.hours.friday) }),
      ...(parseHours(p.hours?.saturday) !== undefined && { saturday: parseHours(p.hours.saturday) }),
      ...(parseHours(p.hours?.sunday) !== undefined && { sunday: parseHours(p.hours.sunday) }),
      ...(p.hours?.note && { note: p.hours.note }),
    },
    theme: {
      preset: p.theme_preset,
      ...(p.theme_variant && { variant: p.theme_variant }),
      ...(p.theme_hero && { heroVariant: p.theme_hero }),
      ...(p.theme_accent && { accent: p.theme_accent }),
    },
    domain: {
      primary: p.primary_domain,
      canonicalScheme: "https",
    },
    integrations: {
      plausible: p.plausible ?? true,
      zaraz: p.zaraz ?? false,
      ...(p.ga4_id && { ga4: p.ga4_id }),
      ...(p.meta_pixel && { metaPixel: p.meta_pixel }),
    },
    reviews: p.reviews ?? [],
    rodo: {
      consentVersion: p.consent_version || "v1.0",
      ...(p.privacy_policy_url && { privacyPolicyUrl: p.privacy_policy_url }),
      ...(p.terms_url && { termsUrl: p.terms_url }),
      dpaSigned: p.dpa_signed,
    },
    ...(Array.isArray(p.theme_sections) && p.theme_sections.length > 0 && {
      sections: p.theme_sections.filter((s) => s && typeof s.kind === "string"),
    }),
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const client = locals.client;
  if (!env?.DB || !client) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let payload: OnboardingPayload;
  try {
    payload = (await request.json()) as OnboardingPayload;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const errors = validate(payload);
  if (errors.length > 0) {
    return new Response(JSON.stringify({ ok: false, errors }), { status: 422, headers: { "Content-Type": "application/json" } });
  }

  // Fetch existing data from clients + client_contacts (NIP/phone/email set during preonboard)
  const existing = await env.DB
    .prepare(
      `SELECT c.business_name, c.nip, cc.contact_email_enc, cc.contact_phone_enc
         FROM clients c JOIN client_contacts cc ON cc.client_id = c.id
        WHERE c.id = ? LIMIT 1`,
    )
    .bind(client.id)
    .first<{ business_name: string; nip: string; contact_email_enc: string; contact_phone_enc: string | null }>();

  if (!existing) {
    return new Response(JSON.stringify({ ok: false, error: "Klient nie istnieje w bazie" }), { status: 404, headers: { "Content-Type": "application/json" } });
  }

  const email = existing.contact_email_enc.startsWith("dev:") ? existing.contact_email_enc.slice(4) : existing.contact_email_enc;
  const phone = existing.contact_phone_enc?.startsWith("dev:") ? existing.contact_phone_enc.slice(4) : (existing.contact_phone_enc ?? "");

  const config = buildClientConfig(payload, client.id, existing.business_name, existing.nip, phone, email);

  // UPSERT client_provisioning_configs
  await env.DB
    .prepare(
      `INSERT INTO client_provisioning_configs (client_id, config_json, wizard_version, provisioning_status)
       VALUES (?, ?, 'v1', 'pending')
       ON CONFLICT (client_id) DO UPDATE SET
         config_json = excluded.config_json,
         provisioning_status = 'pending',
         generated_at = datetime('now'),
         provisioning_error = NULL`,
    )
    .bind(client.id, JSON.stringify(config))
    .run();

  // Update klient with refined data
  await env.DB
    .prepare(
      `UPDATE clients
          SET industry = ?, subtype_schema = ?, theme_preset = ?, theme_variant = ?,
              city = ?, postal_code = ?, voivodeship = ?, primary_domain = ?,
              legal_name = COALESCE(?, legal_name), regon = COALESCE(?, regon)
        WHERE id = ?`,
    )
    .bind(
      payload.industry, payload.schema_type, payload.theme_preset, payload.theme_variant ?? null,
      payload.city, payload.postal_code, payload.voivodeship, payload.primary_domain,
      payload.legal_name ?? null, payload.regon ?? null,
      client.id,
    )
    .run();

  // Audit log
  await env.DB
    .prepare(
      `INSERT INTO audit_log (actor, action, resource_type, resource_id, client_id, severity, metadata_json)
       VALUES (?, 'onboarding.wizard.submitted', 'client', ?, ?, 'info', ?)`,
    )
    .bind(`client:${client.id}`, client.id, client.id, JSON.stringify({ tier: client.tier, domain: payload.primary_domain, domain_source: payload.domain_source }))
    .run();

  return new Response(JSON.stringify({ ok: true, data: { client_id: client.id, next: "/onboarding/complete" } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
