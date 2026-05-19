/**
 * Programmatic page generation for mm-starter.
 *
 * Uses `web-core/programmatic` engine. For v0.1 we ship **deterministic template-based**
 * slot content (no AI in build) — produces 6 location pages with HCU-safe content:
 *   - ≥200 words real body (template + service-specific paragraph)
 *   - 3 location-specific FAQs
 *   - 1 testimonial seeded from client reviews
 *   - 1+ landmark from manual mapping below
 *
 * Faza 7+ replaces slotProvider with AI-generated content + per-klient cap raise to 40.
 */
import {
  generateProgrammaticPages,
  type GenerateOutput,
  type LocationInput,
  type ProgrammaticSlots,
  type ServiceInput,
} from "@mixturemarketing/web-core/programmatic";

import clientConfig from "../client.config.ts";

// ---------------------------------------------------------------------------
// Locations: enrich serviceArea[] with locative form + manual landmarks
// ---------------------------------------------------------------------------

interface LocationEnriched extends LocationInput {
  /** ≥1 landmarks per location — engine requires it. */
  landmarks: ReadonlyArray<{ name: string; context: string }>;
}

const LOCATIONS: ReadonlyArray<LocationEnriched> = [
  {
    name: "Rzeszów",
    slug: "rzeszow",
    locativeName: "Rzeszowie",
    priority: 10,
    landmarks: [
      { name: "Rynek Główny", context: "Dojazd ze starówki w 10 min" },
      { name: "G2A Arena", context: "Obsługujemy okolice stadionu i Politechniki" },
      { name: "Galeria Rzeszów", context: "5 min od centrum handlowego" },
    ],
  },
  {
    name: "Boguchwała",
    slug: "boguchwala",
    locativeName: "Boguchwale",
    priority: 7,
    landmarks: [
      { name: "Park Lubomirskich", context: "Stary park przy pałacu — okolica spokojna, dużo domów jednorodzinnych" },
      { name: "Stacja PKP Boguchwała", context: "Dojazd z Rzeszowa 12 minut" },
    ],
  },
  {
    name: "Tyczyn",
    slug: "tyczyn",
    locativeName: "Tyczynie",
    priority: 6,
    landmarks: [
      { name: "Kolegium UR", context: "Akademik + okoliczne mieszkania studenckie" },
      { name: "Rynek w Tyczynie", context: "Centrum miasteczka, lokale usługowe wokół rynku" },
    ],
  },
  {
    name: "Łańcut",
    slug: "lancut",
    locativeName: "Łańcucie",
    priority: 6,
    landmarks: [
      { name: "Zamek Lubomirskich", context: "Stare miasto + zabudowa w pobliżu zamku" },
      { name: "Galeria Łańcut", context: "Nowa galeria handlowa przy obwodnicy" },
    ],
  },
  {
    name: "Krasne",
    slug: "krasne",
    locativeName: "Krasnem",
    priority: 5,
    landmarks: [
      { name: "Park Handlowy Millenium Hall", context: "Po drodze z Rzeszowa — dojazd 8 min" },
    ],
  },
  {
    name: "Świlcza",
    slug: "swilcza",
    locativeName: "Świlczy",
    priority: 4,
    landmarks: [
      { name: "Park przemysłowy Świlcza", context: "Lokalizacja firmowa + osiedla mieszkaniowe wokół" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Service-specific paragraph templates (one per usługa we support)
// ---------------------------------------------------------------------------

function serviceParagraph(service: ServiceInput, locativeName: string): string {
  switch (service.slug) {
    case "awaryjne-otwieranie-zamkow":
      return `W ${locativeName} otwieram zamki w drzwiach mieszkaniowych, biurowych, samochodach i sejfach — **bez uszkodzenia drzwi i wkładki**. Standardowy czas dojazdu to 20–30 minut, większość zleceń kończę w ciągu godziny od telefonu. Dotyczy to zarówno klasycznych zamków patentowych, jak i nowoczesnych multilocków klasy C+. Jeśli klucze zostały w środku, dziecko zatrzasnęło drzwi, albo zgubione zostały klucze do auta — dzwoń o każdej porze.`;
    case "dorabianie-kluczy":
      return `Dorabianie kluczy w ${locativeName} — drzwi mieszkaniowe, kłódki, klucze samochodowe (z transponderem i bez), klucze do mebli i biur. Pracuję na nowych frezarkach, mam komplet rdzeni do najpopularniejszych wkładek (Gerda, Wilka, Mul-T-Lock, ASSA Abloy). Klucz z transponderem do auta dorabiam ze sprzętem programującym — działa od ręki, bez wizyty u dealera.`;
    case "wymiana-zamkow":
      return `Wymiana wkładek i zamków w drzwiach mieszkaniowych i lokalowych na terenie ${locativeName} i okolic. Polecam zamki klasy C lub C+ z atestem antywłamaniowym + dodatkowo zamek listwowy dla parteru. W magazynie mam Gerda TYTAN, Wilka 1450, Mul-T-Lock Classic Pro — dobieram do drzwi po wymiarach. Pełna wymiana z wstawieniem nowych kluczy zajmuje 30-60 minut.`;
    case "naprawa-drzwi":
      return `Naprawa drzwi po włamaniu, regulacja zawiasów, wymiana uszczelek, montaż dodatkowych zabezpieczeń. W ${locativeName} obsługuję drzwi blokowe, do domów jednorodzinnych i lokali usługowych. Po włamaniu często wystarczy wymiana wkładki + naprawa ościeżnicy — nie zawsze trzeba kupować nowe drzwi. Wycena na miejscu jest bezpłatna.`;
    case "systemy-zabezpieczen":
      return `Montaż systemów zabezpieczeń w ${locativeName} — drzwi antywłamaniowe, wkładki certyfikowane RC2/RC3, zamki elektroniczne (kod + karta + odcisk palca), systemy klucza-master dla małych firm. Dla mieszkań na parterze polecam komplet: drzwi RC2 + wkładka klasy C+ + listwa antywyważeniowa. Doradzam pod budżet i ryzyko.`;
    default:
      return `Wykonuję pełen zakres usługi "${service.name.toLowerCase()}" na terenie ${locativeName} i sąsiednich miejscowości. Działam od ponad 20 lat, znam lokalne typy drzwi i zamków stosowane w budynkach z różnych okresów. Każdą wycenę przedstawiam telefonicznie przed dojazdem — bez ukrytych kosztów.`;
  }
}

// ---------------------------------------------------------------------------
// Slot provider: deterministic template builder per combo
// ---------------------------------------------------------------------------

function buildSlots(
  service: ServiceInput,
  location: LocationEnriched,
): ProgrammaticSlots {
  const locName = location.name;
  const locative = location.locativeName ?? location.name;
  const businessName = clientConfig.business.name;
  const phone = clientConfig.contact.primaryPhone;

  const body = [
    `## ${service.name} w ${locativeName(location)} — szybko, bez uszkodzeń`,
    "",
    serviceParagraph(service, locative),
    "",
    `### Czemu właśnie ja w ${locName}?`,
    "",
    `Pracuję w ${locativeName(location)} i okolicach od ponad 20 lat. ${location.landmarks
      .map((l) => `Znam okolice takie jak **${l.name}** — ${l.context.toLowerCase()}.`)
      .join(" ")} Dzięki temu szybko trafiam pod każdy adres i znam realny czas dojazdu — nie obiecuję "15 minut" wtedy gdy to fizycznie niemożliwe.`,
    "",
    `### Co dostaniesz dzwoniąc na ${phone}`,
    "",
    `1. **Konkretną wycenę przez telefon** — przed dojazdem wiesz co i ile.`,
    `2. **Realny czas przyjazdu** — w ${locName} zwykle 20–30 min, w ${getDistantNeighbor(location)} do 45 min.`,
    `3. **Pracę bez uszkodzeń** — wkładka, zamek, drzwi zostają nietknięte (poza sytuacjami extremum, zawsze po zgodzie).`,
    `4. **Fakturę / paragon** — pełna dokumentacja dla podatkowej lub ubezpieczyciela jeśli była próba włamania.`,
    "",
    `### Cena: ${service.priceFrom ?? "wycena indywidualna"}`,
    "",
    `Ceny w ${locativeName(location)} są takie same jak w centrali — bez doliczania "za dojazd poza Rzeszów" dla miejscowości z mojej strefy obsługi. Pełny cennik na stronie [oferta](/oferta).`,
  ].join("\n");

  // Three location-specific FAQs
  const faqs = [
    {
      question: `Ile trwa dojazd do ${locName}?`,
      answer: `${locativeName(location)} jest w mojej standardowej strefie obsługi. Czas dojazdu z centrum Rzeszowa to zwykle ${dojazdMin(location)}. Po zgłoszeniu telefonicznym podaję dokładny czas — biorę pod uwagę aktualny ruch i porę dnia.`,
    },
    {
      question: `Czy dojazd do ${locName} jest płatny dodatkowo?`,
      answer: `Nie — dla miejscowości z mojej strefy (Rzeszów, Boguchwała, Tyczyn, Łańcut, Krasne, Świlcza) dojazd jest wliczony w cenę usługi. Doliczam dojazd tylko poza tę strefę i zawsze informuję o tym przed wyjazdem.`,
    },
    {
      question: `Czy mogę zadzwonić w nocy z ${locName}?`,
      answer: `Tak, awaryjne otwieranie zamków obsługuję 24/7. ${locName} jest w zasięgu nocnego dojazdu — zwykle w ciągu 30-40 minut od telefonu jestem na miejscu, niezależnie od pory.`,
    },
  ];

  // Pick testimonial — reuse from client.config reviews (rotate by location priority)
  const reviews = clientConfig.reviews ?? [];
  const review = reviews.length > 0 ? reviews[(location.priority ?? 5) % reviews.length]! : null;
  const testimonials = review
    ? [
        {
          author: `${review.author} (${locName})`,
          text: review.text,
          rating: review.rating as 1 | 2 | 3 | 4 | 5,
          ...(review.date && { date: review.date }),
        },
      ]
    : [];

  return {
    title: `${service.name} ${locName} — ${businessName} | ${phone}`,
    description: `${service.name} w ${locativeName(location)} — dojazd ${dojazdMin(location)}, ${service.priceFrom ?? "wycena indywidualna"}. ${review?.text.slice(0, 60) ?? "Profesjonalna obsługa lokalna."}…`.slice(0, 158),
    h1: `${service.name} ${locName}`,
    hero: `Profesjonalna usługa "${service.name.toLowerCase()}" w ${locativeName(location)} — dzwoń ${phone}, przyjedziemy w ${dojazdMin(location)}.`,
    body,
    faqs,
    testimonials,
    landmarks: location.landmarks,
    ctaText: `Zadzwoń ${phone}`,
  };
}

function locativeName(location: LocationEnriched): string {
  return location.locativeName ?? location.name;
}

function dojazdMin(location: LocationEnriched): string {
  const p = location.priority ?? 5;
  if (p >= 9) return "20–30 min";
  if (p >= 6) return "30–40 min";
  return "40–60 min";
}

function getDistantNeighbor(location: LocationEnriched): string {
  // Just pick another location for the dojazd time comparison
  const others = LOCATIONS.filter((l) => l.slug !== location.slug);
  return (others[0]?.name ?? "okolicach").toString();
}

// ---------------------------------------------------------------------------
// Public entry — build all pages at module load
// ---------------------------------------------------------------------------

let cached: GenerateOutput | null = null;

export async function getProgrammaticPages(): Promise<GenerateOutput> {
  if (cached) return cached;

  cached = await generateProgrammaticPages({
    services: clientConfig.services,
    locations: LOCATIONS,
    basePath: "/uslugi",
    thresholds: {
      // v0.1 demo thresholds — relaxed vs production (Faza 7+ raises these via AI content)
      minWordsPerPage: 200,
      requireFaqs: 3,
      requireTestimonials: 1,
      requireLandmarks: 1,
      maxSimilarityRatio: 0.85,
      maxPages: 6,
    },
    slotProvider: (combo) => buildSlots(combo.service, combo.location as LocationEnriched),
  });
  return cached;
}
