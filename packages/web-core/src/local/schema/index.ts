/**
 * Main builder: input → JSON-LD LocalBusiness (or subtype).
 *
 * Usage:
 *   import { localBusinessSchema } from "@mixturemarketing/web-core/local";
 *   const jsonld = localBusinessSchema({
 *     type: "Locksmith",
 *     url: "https://kowalski-slusarz.pl",
 *     name: "Ślusarz Kowalski",
 *     telephone: "+48171234567",
 *     address: { addressLocality: "Rzeszów", addressCountry: "PL", postalCode: "35-060" },
 *     ...
 *   });
 *
 * Then:
 *   <script type="application/ld+json">{JSON.stringify(jsonld)}</script>
 */

import { z } from "zod";

import { canonicalId } from "./id.js";
import type {
  AddressInput,
  AggregateRatingInput,
  AggregateRatingJsonLd,
  GeoInput,
  GeoCoordinatesJsonLd,
  LocalBusinessInput,
  LocalBusinessJsonLd,
  OfferInput,
  OfferJsonLd,
  OpeningHoursInput,
  OpeningHoursSpecificationJsonLd,
  PostalAddressJsonLd,
} from "./types.js";
import { localBusinessInputSchema } from "./validators.js";

export class LocalBusinessSchemaError extends Error {
  public readonly zodError?: z.ZodError;

  constructor(message: string, zodError?: z.ZodError) {
    super(message);
    this.name = "LocalBusinessSchemaError";
    this.zodError = zodError;
  }
}

/**
 * Build a schema.org LocalBusiness JSON-LD object.
 *
 * Validation: input passed through Zod. On failure throws {@link LocalBusinessSchemaError}.
 * To get a non-throwing variant, use {@link safeLocalBusinessSchema}.
 */
export function localBusinessSchema(input: LocalBusinessInput): LocalBusinessJsonLd {
  const parsed = localBusinessInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new LocalBusinessSchemaError(
      `Invalid LocalBusiness input: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
      parsed.error,
    );
  }

  const data = parsed.data;
  const out: LocalBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": data.type,
    "@id": canonicalId(data.url),
    url: data.url,
    name: data.name,
    address: buildAddress(data.address),
  };

  if (data.description !== undefined) out.description = data.description;
  if (data.telephone !== undefined) out.telephone = data.telephone;
  if (data.email !== undefined) out.email = data.email;
  if (data.geo !== undefined) out.geo = buildGeo(data.geo);
  if (data.openingHoursSpecification?.length) {
    // Zod widens DayOfWeek string-literal union to string after parse — cast back to input shape.
    out.openingHoursSpecification = data.openingHoursSpecification.map((h) =>
      buildOpeningHours(h as OpeningHoursInput),
    );
  }
  if (data.areaServed?.length) {
    out.areaServed = data.areaServed.map((a) => ({ "@type": "Place", name: a }) as const);
  }
  if (data.priceRange !== undefined) out.priceRange = data.priceRange;
  if (data.image?.length) out.image = [...data.image];
  if (data.logo !== undefined) out.logo = data.logo;
  out.hasMap = resolveHasMap(data.hasMap, data.gbpPlaceId);
  if (out.hasMap === undefined) delete out.hasMap;
  if (data.aggregateRating !== undefined) out.aggregateRating = buildRating(data.aggregateRating);
  if (data.sameAs?.length) out.sameAs = [...data.sameAs];
  if (data.currenciesAccepted?.length) out.currenciesAccepted = data.currenciesAccepted.join(", ");
  if (data.paymentAccepted?.length) out.paymentAccepted = data.paymentAccepted.join(", ");
  if (data.makesOffer?.length) out.makesOffer = data.makesOffer.map(buildOffer);
  if (data.foundingDate !== undefined) out.foundingDate = data.foundingDate;
  if (data.numberOfEmployees !== undefined) {
    out.numberOfEmployees = { "@type": "QuantitativeValue", value: data.numberOfEmployees };
  }

  // subtype-specific
  if (data.servesCuisine?.length) out.servesCuisine = [...data.servesCuisine];
  if (data.menu !== undefined) out.menu = data.menu;
  if (data.acceptsReservations !== undefined) out.acceptsReservations = data.acceptsReservations;
  if (data.medicalSpecialty?.length) out.medicalSpecialty = [...data.medicalSpecialty];
  if (data.brand?.length) out.brand = [...data.brand];
  if (data.hasCredential?.length) out.hasCredential = [...data.hasCredential];

  return out;
}

export type SafeResult =
  | { success: true; data: LocalBusinessJsonLd }
  | { success: false; error: LocalBusinessSchemaError };

/** Non-throwing variant — returns Result type. */
export function safeLocalBusinessSchema(input: LocalBusinessInput): SafeResult {
  try {
    return { success: true, data: localBusinessSchema(input) };
  } catch (err) {
    if (err instanceof LocalBusinessSchemaError) {
      return { success: false, error: err };
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sub-builders (exported for advanced composition / testing)
// ---------------------------------------------------------------------------

export function buildAddress(input: AddressInput): PostalAddressJsonLd {
  const out: PostalAddressJsonLd = {
    "@type": "PostalAddress",
    addressLocality: input.addressLocality,
    addressCountry: input.addressCountry ?? "PL",
  };
  if (input.streetAddress !== undefined) out.streetAddress = input.streetAddress;
  if (input.addressRegion !== undefined) out.addressRegion = input.addressRegion;
  if (input.postalCode !== undefined) out.postalCode = input.postalCode;
  if (input.postOfficeBoxNumber !== undefined) out.postOfficeBoxNumber = input.postOfficeBoxNumber;
  return out;
}

export function buildGeo(input: GeoInput): GeoCoordinatesJsonLd {
  return {
    "@type": "GeoCoordinates",
    latitude: round6(input.latitude),
    longitude: round6(input.longitude),
  };
}

export function buildOpeningHours(input: OpeningHoursInput): OpeningHoursSpecificationJsonLd {
  const days = Array.isArray(input.dayOfWeek)
    ? [...input.dayOfWeek]
    : ([input.dayOfWeek] as OpeningHoursSpecificationJsonLd["dayOfWeek"]);

  const out: OpeningHoursSpecificationJsonLd = {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: Array.isArray(days) && days.length === 1 ? days[0]! : days,
    opens: input.opens,
    closes: input.closes,
  };
  if (input.validFrom !== undefined) out.validFrom = input.validFrom;
  if (input.validThrough !== undefined) out.validThrough = input.validThrough;
  return out;
}

export function buildRating(input: AggregateRatingInput): AggregateRatingJsonLd {
  return {
    "@type": "AggregateRating",
    ratingValue: round1(input.ratingValue),
    reviewCount: input.reviewCount,
    bestRating: input.bestRating ?? 5,
    worstRating: input.worstRating ?? 1,
  };
}

export function buildOffer(input: OfferInput): OfferJsonLd {
  const out: OfferJsonLd = {
    "@type": "Offer",
    name: input.name,
  };
  if (input.description !== undefined) out.description = input.description;
  if (input.price !== undefined) out.price = input.price;
  out.priceCurrency = input.priceCurrency ?? "PLN";
  out.availability = input.availability ?? "https://schema.org/InStock";
  if (input.validThrough !== undefined) out.validThrough = input.validThrough;
  return out;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function resolveHasMap(explicit: string | undefined, placeId: string | undefined): string | undefined {
  if (explicit !== undefined) return explicit;
  if (placeId !== undefined) return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  return undefined;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
