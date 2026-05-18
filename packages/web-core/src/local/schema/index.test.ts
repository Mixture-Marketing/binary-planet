import { describe, expect, it } from "vitest";

import { weekdays, weekends } from "../hours.js";
import {
  buildAddress,
  buildGeo,
  buildOpeningHours,
  buildRating,
  LocalBusinessSchemaError,
  localBusinessSchema,
  safeLocalBusinessSchema,
} from "./index.js";

const minimalInput = {
  url: "https://kowalski-slusarz.pl",
  name: "Ślusarz Kowalski",
  address: { addressLocality: "Rzeszów", addressCountry: "PL" },
};

describe("localBusinessSchema — happy path", () => {
  it("builds minimal LocalBusiness with required fields", () => {
    const out = localBusinessSchema(minimalInput);
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("LocalBusiness");
    expect(out["@id"]).toBe("https://kowalski-slusarz.pl/#business");
    expect(out.url).toBe(minimalInput.url);
    expect(out.name).toBe(minimalInput.name);
    expect(out.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Rzeszów",
      addressCountry: "PL",
    });
  });

  it("renders all 16 subtypes including LocalBusiness fallback", () => {
    const subtypes = [
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
    for (const t of subtypes) {
      const out = localBusinessSchema({ ...minimalInput, type: t });
      expect(out["@type"]).toBe(t);
    }
  });

  it("includes optional fields when provided", () => {
    const out = localBusinessSchema({
      ...minimalInput,
      type: "Locksmith",
      description: "Profesjonalny ślusarz w Rzeszowie",
      telephone: "+48171234567",
      email: "kontakt@kowalski-slusarz.pl",
      address: {
        streetAddress: "ul. Słowackiego 12",
        addressLocality: "Rzeszów",
        addressRegion: "podkarpackie",
        postalCode: "35-060",
        addressCountry: "PL",
      },
      geo: { latitude: 50.0413, longitude: 21.999 },
      openingHoursSpecification: [weekdays("08:00", "18:00"), weekends("09:00", "14:00")],
      areaServed: ["Rzeszów", "Boguchwała"],
      priceRange: "PLN",
      image: ["https://kowalski-slusarz.pl/logo.png"],
      gbpPlaceId: "ChIJxxxxxxxxxxxxxxxxxxxxxx",
      aggregateRating: { ratingValue: 4.8, reviewCount: 47 },
      sameAs: ["https://facebook.com/kowalski"],
    });

    expect(out["@type"]).toBe("Locksmith");
    expect(out.description).toBe("Profesjonalny ślusarz w Rzeszowie");
    expect(out.telephone).toBe("+48171234567");
    expect(out.email).toBe("kontakt@kowalski-slusarz.pl");
    expect(out.geo).toEqual({ "@type": "GeoCoordinates", latitude: 50.0413, longitude: 21.999 });
    expect(out.openingHoursSpecification).toHaveLength(2);
    expect(out.openingHoursSpecification?.[0]?.dayOfWeek).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
    expect(out.areaServed).toEqual([
      { "@type": "Place", name: "Rzeszów" },
      { "@type": "Place", name: "Boguchwała" },
    ]);
    expect(out.priceRange).toBe("PLN");
    expect(out.hasMap).toBe("https://www.google.com/maps/place/?q=place_id:ChIJxxxxxxxxxxxxxxxxxxxxxx");
    expect(out.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 47,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("collapses single-day openingHours array to single value", () => {
    const out = localBusinessSchema({
      ...minimalInput,
      openingHoursSpecification: [{ dayOfWeek: ["Saturday"], opens: "10:00", closes: "14:00" }],
    });
    expect(out.openingHoursSpecification?.[0]?.dayOfWeek).toBe("Saturday");
  });

  it("emits subtype-specific fields when set", () => {
    const restaurant = localBusinessSchema({
      ...minimalInput,
      type: "Restaurant",
      servesCuisine: ["polska", "regionalna"],
      menu: "https://example.com/menu",
      acceptsReservations: true,
    });
    expect(restaurant.servesCuisine).toEqual(["polska", "regionalna"]);
    expect(restaurant.menu).toBe("https://example.com/menu");
    expect(restaurant.acceptsReservations).toBe(true);

    const medical = localBusinessSchema({
      ...minimalInput,
      type: "MedicalBusiness",
      medicalSpecialty: ["Pediatrics", "Surgery"],
    });
    expect(medical.medicalSpecialty).toEqual(["Pediatrics", "Surgery"]);
  });

  it("joins currenciesAccepted and paymentAccepted into comma-separated strings", () => {
    const out = localBusinessSchema({
      ...minimalInput,
      currenciesAccepted: ["PLN", "EUR"],
      paymentAccepted: ["Cash", "Credit Card", "BLIK"],
    });
    expect(out.currenciesAccepted).toBe("PLN, EUR");
    expect(out.paymentAccepted).toBe("Cash, Credit Card, BLIK");
  });
});

describe("localBusinessSchema — validation", () => {
  it("throws on invalid postal code", () => {
    expect(() =>
      localBusinessSchema({
        ...minimalInput,
        address: { addressLocality: "Rzeszów", postalCode: "35060" },
      }),
    ).toThrow(LocalBusinessSchemaError);
  });

  it("throws on invalid E.164 phone", () => {
    expect(() => localBusinessSchema({ ...minimalInput, telephone: "501-234-567" })).toThrow(
      LocalBusinessSchemaError,
    );
  });

  it("throws on opens >= closes", () => {
    expect(() =>
      localBusinessSchema({
        ...minimalInput,
        openingHoursSpecification: [{ dayOfWeek: "Monday", opens: "18:00", closes: "08:00" }],
      }),
    ).toThrow(LocalBusinessSchemaError);
  });

  it("allows 00:00 as closes (overnight)", () => {
    const out = localBusinessSchema({
      ...minimalInput,
      openingHoursSpecification: [{ dayOfWeek: "Friday", opens: "20:00", closes: "00:00" }],
    });
    expect(out.openingHoursSpecification?.[0]?.closes).toBe("00:00");
  });

  it("rejects rating outside 1-5", () => {
    expect(() =>
      localBusinessSchema({
        ...minimalInput,
        aggregateRating: { ratingValue: 6, reviewCount: 10 },
      }),
    ).toThrow(LocalBusinessSchemaError);
  });

  it("safe variant returns Result on error instead of throwing", () => {
    const result = safeLocalBusinessSchema({
      ...minimalInput,
      telephone: "not-a-phone",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(LocalBusinessSchemaError);
      expect(result.error.zodError).toBeDefined();
    }
  });
});

describe("sub-builders", () => {
  it("buildAddress defaults country to PL", () => {
    const a = buildAddress({ addressLocality: "Warszawa" });
    expect(a.addressCountry).toBe("PL");
  });

  it("buildGeo rounds to 6 decimals", () => {
    const g = buildGeo({ latitude: 52.22971234567, longitude: 21.012212345 });
    expect(g.latitude).toBe(52.229712);
    expect(g.longitude).toBe(21.012212);
  });

  it("buildOpeningHours preserves single day as string", () => {
    const h = buildOpeningHours({ dayOfWeek: "Wednesday", opens: "09:00", closes: "17:00" });
    expect(h.dayOfWeek).toBe("Wednesday");
  });

  it("buildRating rounds rating to 1 decimal and applies defaults", () => {
    const r = buildRating({ ratingValue: 4.876, reviewCount: 12 });
    expect(r.ratingValue).toBe(4.9);
    expect(r.bestRating).toBe(5);
    expect(r.worstRating).toBe(1);
  });
});
