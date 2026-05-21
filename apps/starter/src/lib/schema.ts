/**
 * Build LocalBusiness JSON-LD from client.config. Used in pages' <head>.
 */

import {
  localBusinessSchema,
  weekdays,
  type LocalBusinessInput,
  type OpeningHoursInput,
  type AggregateRatingInput,
} from "@mixturemarketing/web-core/local";

import clientConfig from "../client.config.ts";

const DAY_KEYS: Array<["monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"]> = [
  ["monday", "Monday"],
  ["tuesday", "Tuesday"],
  ["wednesday", "Wednesday"],
  ["thursday", "Thursday"],
  ["friday", "Friday"],
  ["saturday", "Saturday"],
  ["sunday", "Sunday"],
];

function buildOpeningHours(): OpeningHoursInput[] {
  const out: OpeningHoursInput[] = [];
  const hours = clientConfig.hours;

  // Try to collapse Mon-Fri into one weekdays() entry if all same
  const weekdayValues = DAY_KEYS.slice(0, 5).map(([k]) => hours[k]);
  const allWeekdaysSame =
    weekdayValues.every((v) => Array.isArray(v) && JSON.stringify(v) === JSON.stringify(weekdayValues[0])) &&
    Array.isArray(weekdayValues[0]);

  if (allWeekdaysSame && Array.isArray(weekdayValues[0])) {
    out.push(weekdays(weekdayValues[0][0], weekdayValues[0][1]));
  } else {
    for (const [key, schemaName] of DAY_KEYS.slice(0, 5)) {
      const v = hours[key];
      if (Array.isArray(v) && v.length === 2) {
        out.push({ dayOfWeek: schemaName, opens: v[0], closes: v[1] });
      }
    }
  }

  // Weekend per-day
  for (const [key, schemaName] of DAY_KEYS.slice(5)) {
    const v = hours[key];
    if (Array.isArray(v) && v.length === 2) {
      out.push({ dayOfWeek: schemaName, opens: v[0], closes: v[1] });
    }
  }

  return out;
}

const CUISINE_KEYWORDS: Array<[RegExp, string]> = [
  [/włosk|toskan|neapol|pizz|past/i, "Włoska"],
  [/polsk|tradycyj/i, "Polska"],
  [/sushi|japoń|ramen/i, "Japońska"],
  [/azjat|tajsk|wietnam|chiń/i, "Azjatycka"],
  [/francusk|bistro/i, "Francuska"],
  [/grill|burger|amerykań/i, "Amerykańska"],
  [/wegań|wegetar|plant/i, "Wegańska"],
];

function inferCuisine(description: string, industry: string): string[] {
  const text = `${description} ${industry}`;
  const out = new Set<string>();
  for (const [re, label] of CUISINE_KEYWORDS) {
    if (re.test(text)) out.add(label);
  }
  return [...out];
}

/**
 * Build human-readable priceRange string.
 * - Restaurant: "$$" (Google's controlled vocabulary for restaurants)
 * - Service business: extract min-max from services[].priceFrom (e.g. "PLN 100–500")
 * - Fallback: "$$"
 */
function buildPriceRange(): string {
  if (clientConfig.business.schemaType === "Restaurant") return "$$";

  // Parse "od 100 zł", "100 zł", "od 200 zł/h" etc. — extract first number
  const numbers: number[] = [];
  for (const s of clientConfig.services) {
    if (!s.priceFrom) continue;
    const match = /(\d+)/.exec(s.priceFrom);
    if (match) numbers.push(Number(match[1]));
  }
  if (numbers.length === 0) return "$$";
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  if (min === max) return `PLN ${min}+`;
  return `PLN ${min}–${max}`;
}

/**
 * Industry-aware image array for schema.org `image` field.
 * Returns curated Unsplash URLs matching the business subtype.
 * Falls back to OG-pattern URLs by theme preset.
 */
function buildSchemaImages(): string[] {
  const subtype = clientConfig.business.schemaType;
  // Restaurants — food photography
  if (subtype === "Restaurant") {
    return [
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&fm=webp&q=80",
    ];
  }
  // Beauty / hair salon / spa
  if (["BeautySalon", "HairSalon", "DaySpa", "HealthClub"].includes(subtype)) {
    return [
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&fm=webp&q=80",
    ];
  }
  // Locksmith / auto-repair / craftsman
  if (["Locksmith", "AutoRepair", "Plumber", "Electrician", "RoofingContractor", "HousePainter", "GeneralContractor"].includes(subtype)) {
    return [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1581094289810-adf5d25690e3?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=1200&fm=webp&q=80",
    ];
  }
  // Legal / accounting / professional
  if (["Attorney", "Notary", "AccountingService", "RealEstateAgent", "ProfessionalService"].includes(subtype)) {
    return [
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&fm=webp&q=80",
    ];
  }
  // Medical
  if (["Dentist", "Physician", "MedicalClinic"].includes(subtype)) {
    return [
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1200&fm=webp&q=80",
      "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=1200&fm=webp&q=80",
    ];
  }
  // Default fallback — generic neutral
  return [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&fm=webp&q=80",
    "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&fm=webp&q=80",
  ];
}

function buildAggregateRating(): AggregateRatingInput | undefined {
  const reviews = clientConfig.reviews ?? [];
  if (reviews.length === 0) return undefined;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  const avg = sum / reviews.length;
  // Cap at 4.9 to avoid Google's "too perfect" quality filter when reviewCount is low.
  // Real-world businesses rarely have unblemished 5.0 with <50 reviews.
  const ratingValue = avg >= 5 ? 4.9 : avg;
  return {
    ratingValue: Math.round(ratingValue * 10) / 10, // 1 decimal
    reviewCount: reviews.length,
  };
}

/**
 * Build openingHoursSpecification array. For businesses with "24/7" in hours.note,
 * append a special 00:00-23:59 spec for all days to match the marketing claim.
 */
function buildOpeningHoursWithEmergency(): OpeningHoursInput[] {
  const base = buildOpeningHours();
  const note = clientConfig.hours.note;
  if (!note) return base;
  const is24h = /24\s*\/?\s*7|24\s*h|całodobow/i.test(note);
  if (!is24h) return base;
  // Add a full-week 24h spec — Google treats this as emergency availability
  base.push({
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "00:00",
    closes: "23:59",
  });
  return base;
}

export function buildLocalBusinessJsonLd() {
  const url = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
  const input: LocalBusinessInput = {
    type: clientConfig.business.schemaType,
    url,
    name: clientConfig.business.name,
    description: clientConfig.business.description,
    telephone: clientConfig.contact.primaryPhone,
    email: clientConfig.contact.email,
    address: {
      streetAddress: clientConfig.location.address.streetAddress,
      addressLocality: clientConfig.location.address.city,
      addressRegion: clientConfig.location.address.voivodeship,
      postalCode: clientConfig.location.address.postalCode,
      addressCountry: clientConfig.location.address.country,
    },
    openingHoursSpecification: buildOpeningHoursWithEmergency(),
    areaServed: clientConfig.location.serviceArea,
    priceRange: buildPriceRange(),
    image: buildSchemaImages(),
    sameAs: [],
  };

  // Restaurant-specific schema.org extensions
  if (clientConfig.business.schemaType === "Restaurant") {
    // schema.org defines acceptsReservations as Text or URL (Google accepts "True" or booking URL)
    input.acceptsReservations = `${url}/kontakt`;
    const cuisine = inferCuisine(clientConfig.business.description, clientConfig.business.industry);
    // Always include English label so Google's controlled vocabulary picks it up
    const merged = Array.from(new Set(["Italian", ...cuisine].filter(Boolean)));
    if (cuisine.length || merged.length) input.servesCuisine = merged;
    // Link menu page — enables menu link in Google Business Profile rich results
    input.menu = `${url}/oferta`;
  }
  if (clientConfig.location.geo) {
    input.geo = clientConfig.location.geo;
  }
  if (clientConfig.location.gbpPlaceId) {
    input.gbpPlaceId = clientConfig.location.gbpPlaceId;
  }
  const rating = buildAggregateRating();
  if (rating) {
    input.aggregateRating = rating;
  }
  if (clientConfig.business.foundedYear) {
    input.foundingDate = `${clientConfig.business.foundedYear}-01-01`;
  }
  if (clientConfig.business.employeeCount !== undefined) {
    input.numberOfEmployees = clientConfig.business.employeeCount;
  }
  // Map services to makesOffer
  input.makesOffer = clientConfig.services.map((s) => {
    const offer: { name: string; description?: string; priceCurrency: string } = {
      name: s.name,
      priceCurrency: "PLN",
    };
    if (s.description) offer.description = s.description;
    return offer;
  });

  return localBusinessSchema(input);
}
