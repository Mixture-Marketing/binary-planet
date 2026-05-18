# @mixturemarketing/web-core/local

Najważniejszy moduł `web-core` (Track D done). Implementuje **fundament local SEO**:

- LocalBusiness JSON-LD + 15 subtypów schema.org
- PostalAddress, GeoCoordinates, OpeningHoursSpecification, AggregateRating, Offer
- PL helpers: walidacja kodu pocztowego, normalizacja województw, major cities + coords
- Hours DSL: `weekdays()`, `weekends()`, `schedule()`, `open24_7()`
- Geo: bbox PL, distance Haversine
- sitemap.xml + sitemap-index builders
- robots.txt builder
- llms.txt curator (proposed AI crawler standard)

**Status:** v0.0.1 funkcjonalny. Wszystkie 67 testów pass (build + typecheck zielone).

## Quick start

```ts
import {
  localBusinessSchema,
  weekdays,
  weekends,
  buildSitemap,
  buildRobotsTxt,
  buildLocalBusinessLlmsTxt,
} from "@mixturemarketing/web-core/local";

// 1. LocalBusiness JSON-LD
const jsonld = localBusinessSchema({
  type: "Locksmith",
  url: "https://kowalski-slusarz.pl",
  name: "Ślusarz Kowalski",
  description: "Profesjonalny ślusarz w Rzeszowie z 20-letnim doświadczeniem",
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
  openingHoursSpecification: [
    weekdays("08:00", "18:00"),
    weekends("09:00", "14:00"),
  ],
  areaServed: ["Rzeszów", "Boguchwała", "Tyczyn"],
  priceRange: "PLN",
  image: ["https://kowalski-slusarz.pl/logo.png"],
  gbpPlaceId: "ChIJ...",
  aggregateRating: { ratingValue: 4.8, reviewCount: 47 },
  sameAs: ["https://facebook.com/kowalski"],
});

// In Astro template:
// <script type="application/ld+json" set:html={JSON.stringify(jsonld)} />

// 2. Sitemap
const sitemapXml = buildSitemap([
  { loc: "https://kowalski-slusarz.pl/", lastmod: "2026-05-18", priority: 1.0 },
  { loc: "https://kowalski-slusarz.pl/uslugi", lastmod: "2026-05-18", priority: 0.8 },
  { loc: "https://kowalski-slusarz.pl/kontakt", priority: 0.7 },
]);

// 3. robots.txt
const robotsTxt = buildRobotsTxt({
  sitemap: "https://kowalski-slusarz.pl/sitemap.xml",
});

// 4. llms.txt
const llmsTxt = buildLocalBusinessLlmsTxt({
  name: "Ślusarz Kowalski",
  summary: "Profesjonalny ślusarz w Rzeszowie. Otwieranie zamków, dorabianie kluczy, awaryjne wezwania 24/7.",
  homepageUrl: "https://kowalski-slusarz.pl/",
  servicesUrl: "https://kowalski-slusarz.pl/uslugi",
  contactUrl: "https://kowalski-slusarz.pl/kontakt",
});
```

## 15 subtypów LocalBusiness

| Subtype | Theme preset | PL label |
|---------|--------------|----------|
| `Locksmith` | craftsman | Ślusarz |
| `AutoRepair` | craftsman | Mechanik samochodowy / Warsztat |
| `Plumber` | craftsman | Hydraulik |
| `Electrician` | craftsman | Elektryk |
| `AccountingService` | professional | Biuro rachunkowe |
| `Notary` | professional | Notariusz |
| `Architect` | professional | Architekt |
| `RealEstateAgent` | professional | Pośrednik nieruchomości |
| `ProfessionalService` | professional | Usługi profesjonalne |
| `MedicalBusiness` | medical | Gabinet medyczny / Klinika |
| `BeautySalon` | beauty | Salon urody |
| `HairSalon` | beauty | Salon fryzjerski |
| `Restaurant` | food | Restauracja |
| `MovingCompany` | local-services | Firma przeprowadzkowa |
| `ChildCare` | local-services | Opieka nad dziećmi / Żłobek / Przedszkole |
| `LocalBusiness` | generic | Firma lokalna (fallback) |

`getSubtypeMeta(type)`, `getSubtypesForPreset(preset)`, `presetForSubtype(type)` zwracają metadane.

## API surface

| Function | Returns | Notes |
|----------|---------|-------|
| `localBusinessSchema(input)` | `LocalBusinessJsonLd` | Walidacja przez Zod, throws `LocalBusinessSchemaError` |
| `safeLocalBusinessSchema(input)` | `Result` | Non-throwing variant |
| `buildAddress`, `buildGeo`, `buildOpeningHours`, `buildRating`, `buildOffer` | Sub-component JSON-LD | Dla zaawansowanego compose |
| `canonicalId(url)` | `string` | Stable `@id` for cross-page entity matching |
| **Hours DSL** | | |
| `weekdays(opens, closes)` | `OpeningHoursInput` | Mon–Fri |
| `weekends(opens, closes)` | `OpeningHoursInput` | Sat–Sun |
| `singleDay(day, opens, closes)` | `OpeningHoursInput` | |
| `days([...], opens, closes)` | `OpeningHoursInput` | |
| `open24_7()` | `OpeningHoursInput[]` | |
| `schedule({...})` | `OpeningHoursInput[]` | High-level builder |
| **PL helpers** | | |
| `isValidPolishPostalCode(s)` | `boolean` | NN-NNN |
| `normalizePolishPostalCode(s)` | `string \| null` | "35060" → "35-060" |
| `normalizeVoivodeship(s)` | `PolishVoivodeship \| null` | Handles uppercase, EN names, REGON abbreviations |
| `MAJOR_POLISH_CITIES` | `readonly string[]` | ~80 cities |
| **Geo** | | |
| `validateGeo(input)` | `ValidationResult` | Includes Poland bbox warning |
| `distanceKm(a, b)` | `number` | Haversine, km |
| `POLISH_CITY_COORDS` | `Record<string, GeoInput>` | Major cities |
| **Sitemap** | | |
| `buildSitemap(entries, options?)` | `string` (XML) | Validates URLs, lastmod, priority |
| `buildSitemapIndex(entries, options?)` | `string` (XML) | For >50k URLs or logical splits |
| **robots.txt** | | |
| `buildRobotsTxt(options?)` | `string` | Default policy: allow with /admin /api disallowed |
| `NOISY_SEO_BOTS` | `readonly string[]` | AhrefsBot, MJ12bot, etc. |
| **llms.txt** | | |
| `buildLlmsTxt(input)` | `string` (markdown) | Per llmstxt.org spec |
| `buildLocalBusinessLlmsTxt(input)` | `string` | PL convenience helper |

## Validation

Wszystkie inputs walidowane przez Zod (`src/local/schema/validators.ts`). Eksportowane regexy:

- `polishPostalCodeRegex` — `^\d{2}-\d{3}$`
- `e164PhoneRegex` — `^\+[1-9]\d{6,14}$`
- `timeOfDayRegex` — `^([01]\d|2[0-3]):[0-5]\d$`
- `isoDateRegex` — `^\d{4}-\d{2}-\d{2}$`
- `isoCountryRegex` — `^[A-Z]{2}$`
- `gbpPlaceIdRegex` — `^[A-Za-z][A-Za-z0-9_-]{20,}$`

Również same Zod schemas (np. `localBusinessInputSchema`) dla build-time validation w `client.config.ts` w `mm-starter`.

## Co świadomie NIE jest w v0.1

- **Satori OG image generator** — odłożone (heavy dep), własny moduł `web-core/seo/og`
- **Hreflang** — moduł `web-core/seo` (multi-language scope)
- **Article / WebSite / FAQPage / BreadcrumbList JSON-LD** — moduł `web-core/seo`
- **GBP Place ID API verification** — wymaga Google API call, lazy (przy onboarding wizard step 4)
- **Service area jako AdministrativeArea** — używamy `Place` z stringi nazwami (Google akceptuje, prostsze)

## Reference

- Plan: [00-main.md "Faza 1, krytyczny plik #1"](../../../../plan/00-main.md)
- Plan: [B-themes.md (mapping subtypów do tematów)](../../../../plan/B-themes.md)
- Schema.org spec: https://schema.org/LocalBusiness
- sitemaps.org spec: https://www.sitemaps.org/protocol.html
- llmstxt.org spec: https://llmstxt.org/
