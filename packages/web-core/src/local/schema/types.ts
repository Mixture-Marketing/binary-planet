/**
 * TypeScript types matching schema.org LocalBusiness spec.
 * https://schema.org/LocalBusiness
 *
 * Convention: input shape (camelCase) → output JSON-LD (camelCase, schema.org-compliant).
 * Output is what gets serialized into <script type="application/ld+json">.
 */

/**
 * 15 subtypes of LocalBusiness used by MixtureMarketing theme presets,
 * plus generic "LocalBusiness" fallback (16 total).
 *
 * Mapping to themes (plan/B-themes.md):
 *  - craftsman: Locksmith, AutoRepair, Plumber, Electrician
 *  - professional: AccountingService, Notary, Architect, RealEstateAgent, ProfessionalService
 *  - medical: MedicalBusiness
 *  - beauty: BeautySalon, HairSalon
 *  - food: Restaurant (Faza 8)
 *  - local-services: MovingCompany, ChildCare
 */
export const LOCAL_BUSINESS_SUBTYPES = [
  "LocalBusiness",
  "Locksmith",
  "AutoRepair",
  "Notary",
  "Architect",
  "AccountingService",
  "RealEstateAgent",
  "Plumber",
  "Electrician",
  "MedicalBusiness",
  "BeautySalon",
  "HairSalon",
  "Restaurant",
  "MovingCompany",
  "ChildCare",
  "ProfessionalService",
] as const;

export type LocalBusinessSubtype = (typeof LOCAL_BUSINESS_SUBTYPES)[number];

/**
 * 16 polskich województw (administrative regions). Used in PostalAddress.addressRegion.
 * Lowercase per common practice; can be normalized via {@link normalizeRegion}.
 */
export const POLISH_VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
] as const;

export type PolishVoivodeship = (typeof POLISH_VOIVODESHIPS)[number];

export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Input shape — PostalAddress.
 * Most fields optional except addressLocality (city) + addressCountry.
 * Polish addresses: postal code MUST match /^\d{2}-\d{3}$/ (validated in validators.ts).
 */
export interface AddressInput {
  streetAddress?: string;
  addressLocality: string;
  addressRegion?: PolishVoivodeship | string;
  postalCode?: string;
  addressCountry?: string; // ISO 3166-1 alpha-2, default "PL"
  postOfficeBoxNumber?: string;
}

/** Output JSON-LD PostalAddress. */
export interface PostalAddressJsonLd {
  "@type": "PostalAddress";
  streetAddress?: string;
  addressLocality: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry: string;
  postOfficeBoxNumber?: string;
}

export interface GeoInput {
  latitude: number;
  longitude: number;
}

export interface GeoCoordinatesJsonLd {
  "@type": "GeoCoordinates";
  latitude: number;
  longitude: number;
}

/**
 * Time as 24h "HH:MM" (e.g. "08:00", "18:30"). Validated in hours.ts.
 */
export type TimeOfDay = string;

export interface OpeningHoursInput {
  /**
   * One or more days. Most builders pass an array; single day OK too.
   * Use {@link OPEN_24_7} sentinel via dedicated helper instead of trying to express it here.
   */
  dayOfWeek: DayOfWeek | readonly DayOfWeek[];
  opens: TimeOfDay;
  closes: TimeOfDay;
  /** ISO date "YYYY-MM-DD" — used for one-off holiday hours. Optional. */
  validFrom?: string;
  validThrough?: string;
}

export interface OpeningHoursSpecificationJsonLd {
  "@type": "OpeningHoursSpecification";
  dayOfWeek: DayOfWeek | DayOfWeek[];
  opens: string;
  closes: string;
  validFrom?: string;
  validThrough?: string;
}

export interface AggregateRatingInput {
  /** 1.0 – 5.0 */
  ratingValue: number;
  /** Total number of reviews. */
  reviewCount: number;
  /** Best rating in the scale, default 5. */
  bestRating?: number;
  /** Worst rating in the scale, default 1. */
  worstRating?: number;
}

export interface AggregateRatingJsonLd {
  "@type": "AggregateRating";
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
  worstRating: number;
}

export interface OfferInput {
  /** Service / product name */
  name: string;
  description?: string;
  /** PLN amount as string per schema.org guidance, e.g. "150.00". Omit if "from X" / quote-based. */
  price?: string;
  /** ISO 4217, default "PLN" */
  priceCurrency?: string;
  /** "https://schema.org/InStock" | "PreOrder" | etc. Defaults to InStock. */
  availability?: string;
  /** ISO date — when offer expires. */
  validThrough?: string;
}

export interface OfferJsonLd {
  "@type": "Offer";
  name: string;
  description?: string;
  price?: string;
  priceCurrency?: string;
  availability?: string;
  validThrough?: string;
}

/**
 * Main input for {@link localBusinessSchema}.
 * Subtype-specific extensions live in {@link SubtypeSpecificInput}.
 */
export interface LocalBusinessInputBase {
  /** Subtype @type. Defaults to "LocalBusiness". */
  type?: LocalBusinessSubtype;

  /** Canonical URL — used as @id. Required for stable cross-page Schema entity. */
  url: string;

  /** Business name (display name on Google). */
  name: string;

  /** Short tagline / description (max ~155 chars recommended). */
  description?: string;

  /** Phone in E.164 format preferred: "+48171234567". International dialer-friendly. */
  telephone?: string;

  email?: string;

  /** PostalAddress — required for LocalBusiness. */
  address: AddressInput;

  /** Geo (highly recommended for local SEO + GBP alignment). */
  geo?: GeoInput;

  /** Opening hours — array of OpeningHoursSpecification entries. */
  openingHoursSpecification?: readonly OpeningHoursInput[];

  /**
   * Service area — cities / districts. Can be plain strings (cities) or
   * URLs (canonical AdministrativeArea pages). Plain strings rendered as schema:Place.
   */
  areaServed?: readonly string[];

  /**
   * priceRange — Google strongly recommends. PLN symbol or "Cena na zapytanie",
   * or schema.org convention like "$" / "$$" / "$$$".
   */
  priceRange?: string;

  /** Images: logo + up to 4 location photos. URLs absolute. */
  image?: readonly string[];

  /** Logo (used by Google Knowledge Panel). Should be square, 112x112+ min, transparent PNG. */
  logo?: string;

  /**
   * Google Business Profile Place ID — used in hasMap URL.
   * Format: "ChIJ..." (alphanumeric).
   */
  gbpPlaceId?: string;

  /** Override hasMap URL if klient ma niestandardowy GBP CID URL. */
  hasMap?: string;

  /** Aggregate rating — sourced from GBP reviews aggregation. */
  aggregateRating?: AggregateRatingInput;

  /**
   * sameAs URLs — Google verifies entity linking. Recommended:
   *  - https://www.google.com/maps/place/?q=place_id:ChIJ...
   *  - Facebook, Instagram, LinkedIn (B2B)
   *  - Allegro / OLX (commerce)
   */
  sameAs?: readonly string[];

  /** Currencies accepted, default ["PLN"]. */
  currenciesAccepted?: readonly string[];

  /** Payment methods accepted, e.g. ["Cash", "Credit Card", "BLIK"]. */
  paymentAccepted?: readonly string[];

  /** Offers / services — used for OfferCatalog or hasOfferCatalog. */
  makesOffer?: readonly OfferInput[];

  /** ISO date — when the business was founded. */
  foundingDate?: string;

  /** Number of employees (rough). */
  numberOfEmployees?: number;
}

/**
 * Subtype-specific optional fields. Use as discriminated union via `type`.
 * Most subtypes need nothing extra; few have specific fields.
 */
export interface SubtypeSpecificInput {
  /** Restaurant: cuisines served, e.g. ["polska", "regionalna", "włoska"]. */
  servesCuisine?: readonly string[];
  /** Restaurant: menu URL. */
  menu?: string;
  /** Restaurant: accepts reservations — schema.org expects Text or URL. Google accepts "True"/"False" string or a booking URL. */
  acceptsReservations?: boolean | string;
  /** MedicalBusiness: specialty list. */
  medicalSpecialty?: readonly string[];
  /** AutoRepair: brands serviced. */
  brand?: readonly string[];
  /** ProfessionalService / Legal: bar / license number. */
  hasCredential?: readonly string[];
}

export type LocalBusinessInput = LocalBusinessInputBase & SubtypeSpecificInput;

/**
 * Output JSON-LD shape (what gets JSON.stringify'd into <script>).
 * @type narrows to the subtype string. @context is always schema.org.
 */
export interface LocalBusinessJsonLd {
  "@context": "https://schema.org";
  "@type": LocalBusinessSubtype;
  "@id": string;

  url: string;
  name: string;
  description?: string;
  telephone?: string;
  email?: string;

  address: PostalAddressJsonLd;
  geo?: GeoCoordinatesJsonLd;
  openingHoursSpecification?: OpeningHoursSpecificationJsonLd[];

  areaServed?: Array<{ "@type": "Place"; name: string } | string>;
  priceRange?: string;
  image?: string[];
  logo?: string;
  hasMap?: string;
  aggregateRating?: AggregateRatingJsonLd;
  sameAs?: string[];
  currenciesAccepted?: string;
  paymentAccepted?: string;
  makesOffer?: OfferJsonLd[];
  foundingDate?: string;
  numberOfEmployees?: { "@type": "QuantitativeValue"; value: number };

  // Subtype-specific (only present when relevant):
  servesCuisine?: string[];
  menu?: string;
  acceptsReservations?: boolean | string;
  medicalSpecialty?: string[];
  brand?: string[];
  hasCredential?: string[];
}
