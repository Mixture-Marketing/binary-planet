/**
 * Onboarding wizard data layer.
 *
 * Validates form payload → builds canonical ClientConfig JSON → inserts:
 *   - clients (status='pending', tier, theme, slug...)
 *   - client_contacts (encrypted PII — for v0.1 we store plaintext_dev tagged; production: AES-GCM)
 *   - client_provisioning_configs (the full ClientConfig as JSON)
 *
 * The provisioning_status starts 'pending' — Track 4 worker picks it up via cron.
 *
 * NOTE: This is the SINGLE source of truth for what a klient config looks like.
 * The shape mirrors apps/starter/src/client.config.schema.ts — keep in sync.
 */

export interface OnboardingPayload {
  // Business
  business_name: string;
  legal_name?: string;
  nip: string; // 10 digits
  regon?: string;
  krs?: string;
  industry: string;
  schema_type: string; // LocalBusiness subtype
  founded_year?: number;
  employee_count?: number;
  description: string;
  tagline: string;
  long_description: string;

  // Contact
  primary_phone: string; // E164 +48...
  secondary_phone?: string;
  email: string;
  notification_email?: string;
  contact_person_name?: string;

  // Location
  street_address: string;
  city: string;
  voivodeship: string;
  postal_code: string; // NN-NNN
  latitude?: number;
  longitude?: number;
  gbp_place_id?: string;
  service_area: string[]; // city names

  // Services (1..8)
  services: Array<{
    slug: string;
    name: string;
    description: string;
    price_from?: string;
    icon_key?: string;
  }>;

  // Hours — per-day "HH:MM-HH:MM" or "closed"
  hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
    note?: string;
  };

  // Theme
  theme_preset: "craftsman" | "professional" | "medical" | "beauty" | "local-services" | "food" | "generic";
  theme_variant?: string;

  // Domain
  primary_domain: string; // no scheme — "kowalski-slusarz.pl"
  canonical_scheme: "https";

  // Tier
  tier: "starter" | "standard" | "premium" | "professional";

  // Integrations
  plausible: boolean;
  zaraz: boolean;
  ga4_id?: string;
  meta_pixel?: string;
  google_ads_conversion_id?: string;
  turnstile_site_key?: string;

  // Reviews (0..*)
  reviews: Array<{
    author: string;
    rating: number; // 1..5
    date: string; // YYYY-MM-DD
    text: string;
    source: "gbp" | "manual" | "facebook";
  }>;

  // RODO
  consent_version: string; // "v1.0"
  privacy_policy_url?: string;
  terms_url?: string;
  dpa_signed: boolean;

  // Admin notes
  notes?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/** Lightweight validation mirroring client.config.schema.ts. Server-side only. */
export function validateOnboarding(p: OnboardingPayload): ValidationError[] {
  const errors: ValidationError[] = [];
  const reqStr = (v: unknown, field: string, label: string) => {
    if (typeof v !== "string" || v.trim().length === 0) errors.push({ field, message: `${label} jest wymagane` });
  };
  reqStr(p.business_name, "business_name", "Nazwa firmy");
  reqStr(p.industry, "industry", "Branża");
  reqStr(p.schema_type, "schema_type", "Typ LocalBusiness");
  reqStr(p.description, "description", "Krótki opis");
  reqStr(p.tagline, "tagline", "Tagline");
  reqStr(p.long_description, "long_description", "Długi opis");
  reqStr(p.email, "email", "Email kontaktowy");
  reqStr(p.primary_phone, "primary_phone", "Telefon");
  reqStr(p.street_address, "street_address", "Ulica i numer");
  reqStr(p.city, "city", "Miasto");
  reqStr(p.voivodeship, "voivodeship", "Województwo");
  reqStr(p.postal_code, "postal_code", "Kod pocztowy");

  if (!/^\d{10}$/.test(p.nip)) errors.push({ field: "nip", message: "NIP musi mieć 10 cyfr (bez spacji)" });
  if (p.regon && !/^\d{9}(\d{5})?$/.test(p.regon)) errors.push({ field: "regon", message: "REGON musi mieć 9 lub 14 cyfr" });
  if (!/^\d{2}-\d{3}$/.test(p.postal_code)) errors.push({ field: "postal_code", message: "Kod pocztowy w formacie NN-NNN" });
  if (!/^\+\d{8,15}$/.test(p.primary_phone)) errors.push({ field: "primary_phone", message: "Telefon w formacie międzynarodowym +48..." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push({ field: "email", message: "Nieprawidłowy email" });

  if (!Array.isArray(p.service_area) || p.service_area.length === 0) {
    errors.push({ field: "service_area", message: "Podaj co najmniej jedno miasto obsługi" });
  }
  if (!Array.isArray(p.services) || p.services.length === 0 || p.services.length > 8) {
    errors.push({ field: "services", message: "Wpisz od 1 do 8 usług" });
  } else {
    for (const [i, s] of p.services.entries()) {
      if (!/^[a-z0-9-]+$/.test(s.slug)) errors.push({ field: `services.${i}.slug`, message: `Usługa #${i + 1}: slug małe litery + myślniki` });
      if (!s.name || s.name.length === 0) errors.push({ field: `services.${i}.name`, message: `Usługa #${i + 1}: nazwa wymagana` });
      if (!s.description || s.description.length > 500) errors.push({ field: `services.${i}.description`, message: `Usługa #${i + 1}: opis max 500 znaków` });
    }
  }

  if (!/^https?:\/\/[\w.-]+/.test(`https://${p.primary_domain}`)) {
    errors.push({ field: "primary_domain", message: "Domena w formacie example.pl (bez https://)" });
  }

  if (!["starter", "standard", "premium", "professional"].includes(p.tier)) {
    errors.push({ field: "tier", message: "Wybierz pakiet" });
  }
  if (!p.dpa_signed) {
    errors.push({ field: "dpa_signed", message: "Akceptacja DPA wymagana" });
  }

  return errors;
}

/** Generate slug-id from business_name + city. e.g. "Ślusarz Kowalski" + "Rzeszów" → "clk_slusarz_kowalski_rzeszow" */
export function generateClientId(businessName: string, city: string): string {
  const slug = `${businessName} ${city}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `clk_${slug}`;
}

/** Transform DB-shape payload → ClientConfig (matches client.config.schema.ts). */
export function buildClientConfig(p: OnboardingPayload, clientId: string): Record<string, unknown> {
  const parseHours = (s?: string): [string, string] | "closed" | undefined => {
    if (!s) return undefined;
    if (s === "closed") return "closed";
    const m = s.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
    if (!m) return undefined;
    return [m[1]!, m[2]!];
  };

  return {
    clientId,
    business: {
      name: p.business_name,
      ...(p.legal_name && { legalName: p.legal_name }),
      nip: p.nip,
      ...(p.regon && { regon: p.regon }),
      ...(p.krs && { krs: p.krs }),
      industry: p.industry,
      schemaType: p.schema_type,
      ...(p.founded_year && { foundedYear: p.founded_year }),
      ...(p.employee_count && { employeeCount: p.employee_count }),
      description: p.description,
      tagline: p.tagline,
      longDescription: p.long_description,
    },
    contact: {
      primaryPhone: p.primary_phone,
      ...(p.secondary_phone && { secondaryPhone: p.secondary_phone }),
      email: p.email,
      ...(p.notification_email && { notificationEmail: p.notification_email }),
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
      ...(p.gbp_place_id && { gbpPlaceId: p.gbp_place_id }),
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
      ...(parseHours(p.hours.monday) !== undefined && { monday: parseHours(p.hours.monday) }),
      ...(parseHours(p.hours.tuesday) !== undefined && { tuesday: parseHours(p.hours.tuesday) }),
      ...(parseHours(p.hours.wednesday) !== undefined && { wednesday: parseHours(p.hours.wednesday) }),
      ...(parseHours(p.hours.thursday) !== undefined && { thursday: parseHours(p.hours.thursday) }),
      ...(parseHours(p.hours.friday) !== undefined && { friday: parseHours(p.hours.friday) }),
      ...(parseHours(p.hours.saturday) !== undefined && { saturday: parseHours(p.hours.saturday) }),
      ...(parseHours(p.hours.sunday) !== undefined && { sunday: parseHours(p.hours.sunday) }),
      ...(p.hours.note && { note: p.hours.note }),
    },
    theme: {
      preset: p.theme_preset,
      ...(p.theme_variant && { variant: p.theme_variant }),
    },
    domain: {
      primary: p.primary_domain,
      canonicalScheme: p.canonical_scheme,
    },
    integrations: {
      plausible: p.plausible,
      zaraz: p.zaraz,
      ...(p.ga4_id && { ga4: p.ga4_id }),
      ...(p.meta_pixel && { metaPixel: p.meta_pixel }),
      ...(p.google_ads_conversion_id && { googleAdsConversionId: p.google_ads_conversion_id }),
      ...(p.turnstile_site_key && { turnstileSiteKey: p.turnstile_site_key }),
    },
    reviews: p.reviews ?? [],
    rodo: {
      consentVersion: p.consent_version,
      ...(p.privacy_policy_url && { privacyPolicyUrl: p.privacy_policy_url }),
      ...(p.terms_url && { termsUrl: p.terms_url }),
      dpaSigned: p.dpa_signed,
    },
  };
}

/** Insert all rows in a single transaction-ish flow (best-effort sequential w/o D1 BEGIN). */
export async function createClientFromWizard(
  db: D1Database,
  payload: OnboardingPayload,
  adminUserId: string,
): Promise<{ ok: true; clientId: string } | { ok: false; errors: ValidationError[] }> {
  const errors = validateOnboarding(payload);
  if (errors.length > 0) return { ok: false, errors };

  const clientId = generateClientId(payload.business_name, payload.city);
  const config = buildClientConfig(payload, clientId);

  // Encode email/phone — for v0.1 dev we store plain text with prefix "dev:" so
  // the schema NOT NULL constraint passes. Track 6 will swap in real AES-GCM.
  const emailEnc = `dev:${payload.email}`;
  const emailHash = await sha256Hex(payload.email.toLowerCase().trim());
  const phoneEnc = `dev:${payload.primary_phone}`;
  const phoneHash = await sha256Hex(payload.primary_phone);

  // clients
  await db
    .prepare(
      `INSERT INTO clients (
         id, business_name, legal_name, nip, regon, krs,
         industry, subtype_schema, theme_preset, theme_variant,
         city, postal_code, voivodeship,
         primary_domain, tier, status,
         feature_flags_json, modules_json,
         signed_dpa_at, signed_dpa_version,
         notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '{}', '[]', ?, ?, ?)`,
    )
    .bind(
      clientId,
      payload.business_name,
      payload.legal_name ?? null,
      payload.nip,
      payload.regon ?? null,
      payload.krs ?? null,
      payload.industry,
      payload.schema_type,
      payload.theme_preset,
      payload.theme_variant ?? null,
      payload.city,
      payload.postal_code,
      payload.voivodeship,
      payload.primary_domain,
      payload.tier,
      payload.dpa_signed ? new Date().toISOString() : null,
      payload.dpa_signed ? payload.consent_version : null,
      payload.notes ?? null,
    )
    .run();

  // client_contacts
  await db
    .prepare(
      `INSERT INTO client_contacts (
         client_id, contact_name, contact_email_enc, contact_email_hash,
         contact_phone_enc, contact_phone_hash
       ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      clientId,
      payload.contact_person_name ?? payload.business_name,
      emailEnc,
      emailHash,
      phoneEnc,
      phoneHash,
    )
    .run();

  // provisioning config
  await db
    .prepare(
      `INSERT INTO client_provisioning_configs (
         client_id, config_json, created_by_user_id
       ) VALUES (?, ?, ?)`,
    )
    .bind(clientId, JSON.stringify(config, null, 2), adminUserId)
    .run();

  return { ok: true, clientId };
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export const POLISH_VOIVODESHIPS = [
  "dolnośląskie", "kujawsko-pomorskie", "lubelskie", "lubuskie", "łódzkie",
  "małopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie",
  "pomorskie", "śląskie", "świętokrzyskie", "warmińsko-mazurskie",
  "wielkopolskie", "zachodniopomorskie",
] as const;

export const INDUSTRIES = [
  { slug: "locksmith", label: "Ślusarz", schemaType: "Locksmith" },
  { slug: "auto_repair", label: "Mechanik / warsztat", schemaType: "AutoRepair" },
  { slug: "carpenter", label: "Stolarz", schemaType: "GeneralContractor" },
  { slug: "plumber", label: "Hydraulik", schemaType: "Plumber" },
  { slug: "electrician", label: "Elektryk", schemaType: "Electrician" },
  { slug: "roofer", label: "Dekarz", schemaType: "RoofingContractor" },
  { slug: "beauty", label: "Salon kosmetyczny", schemaType: "BeautySalon" },
  { slug: "hairdresser", label: "Fryzjer", schemaType: "HairSalon" },
  { slug: "dentist", label: "Dentysta", schemaType: "Dentist" },
  { slug: "physiotherapist", label: "Fizjoterapeuta", schemaType: "Physician" },
  { slug: "accountant", label: "Biuro rachunkowe", schemaType: "AccountingService" },
  { slug: "lawyer", label: "Kancelaria prawna", schemaType: "LegalService" },
  { slug: "restaurant", label: "Restauracja", schemaType: "Restaurant" },
  { slug: "cafe", label: "Kawiarnia", schemaType: "CafeOrCoffeeShop" },
  { slug: "florist", label: "Kwiaciarnia", schemaType: "Florist" },
  { slug: "other", label: "Inna usługa lokalna", schemaType: "LocalBusiness" },
] as const;
