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

function buildAggregateRating(): AggregateRatingInput | undefined {
  const reviews = clientConfig.reviews ?? [];
  if (reviews.length === 0) return undefined;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return {
    ratingValue: sum / reviews.length,
    reviewCount: reviews.length,
  };
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
    openingHoursSpecification: buildOpeningHours(),
    areaServed: clientConfig.location.serviceArea,
    priceRange: "PLN",
    sameAs: [],
  };
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
