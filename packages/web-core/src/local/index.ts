/**
 * @mixturemarketing/web-core/local
 *
 * LocalBusiness JSON-LD schema (15 subtypes) + sitemap + robots + llms.txt + PL helpers.
 *
 * Reference: plan/00-main.md (Faza 1, krytyczny plik #1), plan/B-themes.md.
 *
 * Quick start:
 *   import { localBusinessSchema, weekdays, weekends } from "@mixturemarketing/web-core/local";
 *
 *   const jsonld = localBusinessSchema({
 *     type: "Locksmith",
 *     url: "https://kowalski-slusarz.pl",
 *     name: "Ślusarz Kowalski",
 *     telephone: "+48171234567",
 *     address: { addressLocality: "Rzeszów", postalCode: "35-060", addressCountry: "PL" },
 *     openingHoursSpecification: [weekdays("08:00", "18:00"), weekends("09:00", "14:00")],
 *   });
 */

export const MODULE_NAME = "local" as const;

// Schema builder
export {
  buildAddress,
  buildGeo,
  buildOffer,
  buildOpeningHours,
  buildRating,
  LocalBusinessSchemaError,
  localBusinessSchema,
  safeLocalBusinessSchema,
} from "./schema/index.js";
export { canonicalId } from "./schema/id.js";
export type { SafeResult } from "./schema/index.js";

// Subtype metadata
export {
  getSubtypeMeta,
  getSubtypesForPreset,
  presetForSubtype,
} from "./schema/subtypes.js";
export type { SubtypeMeta, ThemePreset } from "./schema/subtypes.js";

// Types
export type {
  AddressInput,
  AggregateRatingInput,
  AggregateRatingJsonLd,
  DayOfWeek,
  GeoCoordinatesJsonLd,
  GeoInput,
  LocalBusinessInput,
  LocalBusinessInputBase,
  LocalBusinessJsonLd,
  LocalBusinessSubtype,
  OfferInput,
  OfferJsonLd,
  OpeningHoursInput,
  OpeningHoursSpecificationJsonLd,
  PolishVoivodeship,
  PostalAddressJsonLd,
  SubtypeSpecificInput,
  TimeOfDay,
} from "./schema/types.js";
export {
  DAYS_OF_WEEK,
  LOCAL_BUSINESS_SUBTYPES,
  POLISH_VOIVODESHIPS,
} from "./schema/types.js";

// Validators (Zod schemas, for build-time validation in client.config.ts)
export {
  addressInputSchema,
  aggregateRatingInputSchema,
  e164PhoneRegex,
  gbpPlaceIdRegex,
  geoInputSchema,
  isoCountryRegex,
  isoDateRegex,
  localBusinessInputSchema,
  offerInputSchema,
  openingHoursInputSchema,
  polishPostalCodeRegex,
  timeOfDayRegex,
} from "./schema/validators.js";
export type { LocalBusinessInputValidated } from "./schema/validators.js";

// PL address helpers
export {
  isValidPolishPostalCode,
  MAJOR_POLISH_CITIES,
  normalizePolishPostalCode,
  normalizeVoivodeship,
} from "./address.js";

// Geo helpers
export { distanceKm, POLAND_BBOX, POLISH_CITY_COORDS, validateGeo } from "./geo.js";
export type { ValidationResult } from "./geo.js";

// Hours helpers
export {
  ALL_DAYS,
  days,
  open24_7,
  schedule,
  singleDay,
  WEEKDAYS,
  WEEKEND,
  weekdays,
  weekends,
} from "./hours.js";
export type { ScheduleInput } from "./hours.js";

// Sitemap
export { buildSitemap, buildSitemapIndex } from "./sitemap.js";
export type { ChangeFreq, SitemapEntry, SitemapIndexEntry, SitemapOptions } from "./sitemap.js";

// robots.txt
export { buildRobotsTxt, NOISY_SEO_BOTS } from "./robots.js";
export type { RobotsOptions } from "./robots.js";

// llms.txt
export { buildLlmsTxt, buildLocalBusinessLlmsTxt } from "./llms-txt.js";
export type { LlmsTxtInput, LlmsTxtSection, LocalBusinessLlmsTxtInput } from "./llms-txt.js";
