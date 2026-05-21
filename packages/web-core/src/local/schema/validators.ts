/**
 * Zod schemas for runtime validation of LocalBusiness input.
 * Used by:
 *  - {@link localBusinessSchema} as a sanity check before emitting JSON-LD
 *  - client.config.ts validators in mm-starter (catch typos at build time)
 *  - CI lint to block deploys with malformed data
 */

import { z } from "zod";

import { DAYS_OF_WEEK, LOCAL_BUSINESS_SUBTYPES, POLISH_VOIVODESHIPS } from "./types.js";

// Zod's z.enum() requires a mutable tuple [string, ...string[]]. Our constants are readonly arrays
// for safer DX everywhere else — copy to mutable tuples here.
const DAYS_OF_WEEK_TUPLE = [...DAYS_OF_WEEK] as [(typeof DAYS_OF_WEEK)[number], ...(typeof DAYS_OF_WEEK)[number][]];
const LOCAL_BUSINESS_SUBTYPES_TUPLE = [...LOCAL_BUSINESS_SUBTYPES] as [
  (typeof LOCAL_BUSINESS_SUBTYPES)[number],
  ...(typeof LOCAL_BUSINESS_SUBTYPES)[number][],
];
const POLISH_VOIVODESHIPS_TUPLE = [...POLISH_VOIVODESHIPS] as [
  (typeof POLISH_VOIVODESHIPS)[number],
  ...(typeof POLISH_VOIVODESHIPS)[number][],
];

/** Polish postal code: NN-NNN. */
export const polishPostalCodeRegex = /^\d{2}-\d{3}$/;

/** E.164 phone format: + then 7-15 digits. Permissive — does not validate country code. */
export const e164PhoneRegex = /^\+[1-9]\d{6,14}$/;

/** HH:MM 24h. */
export const timeOfDayRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** ISO date YYYY-MM-DD. */
export const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** ISO 3166-1 alpha-2 country code (PL, DE, etc.). */
export const isoCountryRegex = /^[A-Z]{2}$/;

/** GBP Place ID — starts with letter, alphanumeric + underscore + dash. */
export const gbpPlaceIdRegex = /^[A-Za-z][A-Za-z0-9_-]{20,}$/;

export const addressInputSchema = z.object({
  streetAddress: z.string().min(1).max(200).optional(),
  addressLocality: z.string().min(1).max(100),
  addressRegion: z
    .union([z.enum(POLISH_VOIVODESHIPS_TUPLE), z.string().min(1).max(50)])
    .optional(),
  postalCode: z.string().regex(polishPostalCodeRegex, "Polish postal code must match NN-NNN").optional(),
  addressCountry: z
    .string()
    .regex(isoCountryRegex, "addressCountry must be ISO 3166-1 alpha-2 (e.g. PL)")
    .default("PL"),
  postOfficeBoxNumber: z.string().max(20).optional(),
});

export const geoInputSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
});

export const openingHoursInputSchema = z
  .object({
    dayOfWeek: z.union([z.enum(DAYS_OF_WEEK_TUPLE), z.array(z.enum(DAYS_OF_WEEK_TUPLE)).min(1)]),
    opens: z.string().regex(timeOfDayRegex, "opens must be HH:MM"),
    closes: z.string().regex(timeOfDayRegex, "closes must be HH:MM"),
    validFrom: z.string().regex(isoDateRegex).optional(),
    validThrough: z.string().regex(isoDateRegex).optional(),
  })
  .refine(
    (h) => {
      // Allow 00:00 closes to mean "midnight close" (overnight). Otherwise opens < closes.
      if (h.closes === "00:00") return true;
      return h.opens < h.closes;
    },
    { message: "opens must be before closes (use 00:00 for midnight)" },
  );

export const aggregateRatingInputSchema = z
  .object({
    ratingValue: z.number().gte(1).lte(5),
    reviewCount: z.number().int().nonnegative(),
    bestRating: z.number().gte(1).lte(10).default(5),
    worstRating: z.number().gte(0).lte(5).default(1),
  })
  .refine((r) => r.bestRating > r.worstRating, {
    message: "bestRating must be greater than worstRating",
  });

export const offerInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "price must be decimal string e.g. 150.00").optional(),
  priceCurrency: z.string().regex(/^[A-Z]{3}$/).default("PLN"),
  availability: z.string().url().optional(),
  validThrough: z.string().regex(isoDateRegex).optional(),
});

export const localBusinessInputSchema = z.object({
  type: z.enum(LOCAL_BUSINESS_SUBTYPES_TUPLE).default("LocalBusiness"),
  url: z.string().url(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  telephone: z
    .string()
    .regex(e164PhoneRegex, "telephone should be E.164 format e.g. +48171234567")
    .optional(),
  email: z.string().email().optional(),
  address: addressInputSchema,
  geo: geoInputSchema.optional(),
  openingHoursSpecification: z.array(openingHoursInputSchema).optional(),
  areaServed: z.array(z.string().min(1).max(100)).max(50).optional(),
  priceRange: z.string().min(1).max(50).optional(),
  image: z.array(z.string().url()).max(10).optional(),
  logo: z.string().url().optional(),
  gbpPlaceId: z.string().regex(gbpPlaceIdRegex).optional(),
  hasMap: z.string().url().optional(),
  aggregateRating: aggregateRatingInputSchema.optional(),
  sameAs: z.array(z.string().url()).max(20).optional(),
  currenciesAccepted: z.array(z.string().regex(/^[A-Z]{3}$/)).optional(),
  paymentAccepted: z.array(z.string().min(1).max(50)).optional(),
  makesOffer: z.array(offerInputSchema).max(20).optional(),
  foundingDate: z.string().regex(isoDateRegex).optional(),
  numberOfEmployees: z.number().int().positive().optional(),

  // subtype-specific
  servesCuisine: z.array(z.string().min(1).max(50)).max(10).optional(),
  menu: z.string().url().optional(),
  acceptsReservations: z.union([z.boolean(), z.string()]).optional(),
  medicalSpecialty: z.array(z.string().min(1).max(100)).optional(),
  brand: z.array(z.string().min(1).max(100)).optional(),
  hasCredential: z.array(z.string().min(1).max(200)).optional(),
});

export type LocalBusinessInputValidated = z.infer<typeof localBusinessInputSchema>;
