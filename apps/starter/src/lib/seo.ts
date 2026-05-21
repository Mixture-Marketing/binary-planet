/**
 * Comprehensive SEO bundle per page type.
 *
 * Pages call one of these to get all JSON-LD blocks + meta tag inputs in one shot.
 * Then BaseLayout consumes the result.
 */

import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  webPageSchema,
  webSiteSchema,
  type ArticleInput,
  type BreadcrumbItemInput,
  type FaqItem,
  type MetaInput,
} from "@mixturemarketing/web-core/seo";

import clientConfig from "../client.config.ts";
import { buildLocalBusinessJsonLd } from "./schema.ts";

const baseUrl = `${clientConfig.domain.canonicalScheme}://${clientConfig.domain.primary}`;
const siteName = clientConfig.business.name;

/** Canonical URL for a given path. */
export function canonicalUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalized === "/" ? "" : normalized}`;
}

/**
 * Default OG share image — every page MUST have one or social shares blank-out.
 * Per-klient `og-default.jpg` lives in the repo's `public/` (1200×630). Until uploaded,
 * we fall back to a hosted Unsplash card matched to the theme preset.
 */
const OG_FALLBACK_BY_PRESET: Record<string, string> = {
  editorial: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=1200&h=630&fit=crop&q=80",
  elegant: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=630&fit=crop&q=80",
  dynamic: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&h=630&fit=crop&q=80",
  minimalist: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=630&fit=crop&q=80",
};

function defaultOgImage(): { url: string; width: 1200; height: 630; alt: string } {
  const preset = clientConfig.theme.preset;
  const url = OG_FALLBACK_BY_PRESET[preset] ?? OG_FALLBACK_BY_PRESET.editorial!;
  return {
    url,
    width: 1200,
    height: 630,
    alt: `${clientConfig.business.name} — ${clientConfig.business.tagline}`,
  };
}

/**
 * Construct keyword-targeted home title. For restaurants: lead with intent keyword
 * ("Włoska restauracja Kraków") not brand. For services: industry + city + brand.
 */
/** Map LocalBusinessSubtype → friendly PL service noun for title keyword-targeting. */
const SUBTYPE_PL_TITLE: Record<string, string> = {
  Locksmith: "Ślusarz",
  AutoRepair: "Mechanik samochodowy",
  Plumber: "Hydraulik",
  Electrician: "Elektryk",
  HVACBusiness: "Klimatyzacja i ogrzewanie",
  RoofingContractor: "Dekarz",
  HousePainter: "Malarz",
  GeneralContractor: "Usługi remontowe",
  MovingCompany: "Firma przeprowadzkowa",
  BeautySalon: "Salon urody",
  HairSalon: "Salon fryzjerski",
  DaySpa: "Salon SPA",
  HealthClub: "Klub fitness",
  Dentist: "Dentysta",
  Physician: "Lekarz",
  MedicalClinic: "Klinika",
  Notary: "Notariusz",
  Attorney: "Adwokat",
  AccountingService: "Biuro rachunkowe",
  RealEstateAgent: "Pośrednik nieruchomości",
  ChildCare: "Żłobek i przedszkole",
};

function homeTitle(): string {
  const name = clientConfig.business.name;
  const city = clientConfig.location.address.city;
  const tagline = clientConfig.business.tagline;
  const subtype = clientConfig.business.schemaType;
  if (subtype === "Restaurant") {
    const cuisine = /włosk|toskan|neapol/i.test(clientConfig.business.description)
      ? "Włoska restauracja"
      : "Restauracja";
    return `${cuisine} ${city} — ${name} | ${tagline}`;
  }
  const noun = SUBTYPE_PL_TITLE[subtype];
  if (noun) {
    return `${noun} ${city} — ${name} | ${tagline}`;
  }
  return `${name} ${city} | ${tagline}`;
}

/** Shared meta defaults — pages override what's relevant. */
function baseMetaInput(overrides: Partial<MetaInput> & { path: string }): MetaInput {
  return {
    title: homeTitle(),
    description: clientConfig.business.description,
    canonicalUrl: canonicalUrl(overrides.path),
    locale: "pl_PL",
    og: {
      type: "website",
      siteName,
      image: defaultOgImage(),
      ...overrides.og,
    },
    twitter: {
      card: "summary_large_image",
      ...overrides.twitter,
    },
    icons: { svg: "/favicon.svg" },
    themeColor: "var(--color-brand)",
    ...overrides,
  };
}

/** Build organization JSON-LD — reused on every page for entity consistency. */
function buildOrganization(): ReturnType<typeof organizationSchema> {
  const input: Parameters<typeof organizationSchema>[0] = {
    url: baseUrl,
    name: clientConfig.business.name,
    description: clientConfig.business.description,
  };
  if (clientConfig.business.legalName) input.legalName = clientConfig.business.legalName;
  if (clientConfig.business.nip) input.taxID = clientConfig.business.nip;
  if (clientConfig.business.foundedYear) {
    input.foundingDate = `${clientConfig.business.foundedYear}-01-01`;
  }
  input.contactPoints = [
    {
      contactType: "customer service",
      telephone: clientConfig.contact.primaryPhone,
      email: clientConfig.contact.email,
      areaServed: "PL",
      availableLanguage: ["pl"],
    },
  ];
  return organizationSchema(input);
}

/** WebSite JSON-LD — should appear ONLY on home page. */
function buildWebSite(): ReturnType<typeof webSiteSchema> {
  return webSiteSchema({
    url: baseUrl,
    name: siteName,
    description: clientConfig.business.description,
    inLanguage: "pl-PL",
    publisher: { name: siteName, url: baseUrl },
  });
}

// ---------------------------------------------------------------------------
// Page bundles
// ---------------------------------------------------------------------------

export interface PageSeoBundle {
  meta: MetaInput;
  jsonLd: unknown[];
  breadcrumbHtml?: string;
}

/** Home page — LocalBusiness + WebSite + Organization JSON-LD. */
export function homeSeo(): PageSeoBundle {
  const meta = baseMetaInput({
    path: "/",
    // Title built via homeTitle() in baseMetaInput defaults — restaurant gets
    // "Włoska restauracja Kraków — Trattoria Bocca | tagline" (keyword-first).
    description: clientConfig.business.description,
  });
  return {
    meta,
    jsonLd: [buildLocalBusinessJsonLd(), buildWebSite(), buildOrganization()],
    // NOTE: BreadcrumbList intentionally OMITTED on home — web-core lib rejects
    // 1-item breadcrumbs (correct behavior). BreadcrumbList exists on subpages only.
  };
}

/** Oferta page — LocalBusiness + Breadcrumb. */
export function ofertaSeo(): PageSeoBundle {
  const city = clientConfig.location.address.city;
  const subtype = clientConfig.business.schemaType;
  const isRestaurant = subtype === "Restaurant";
  const noun = SUBTYPE_PL_TITLE[subtype] ?? clientConfig.business.industry;
  const title = isRestaurant
    ? `Menu — Karta dań ${siteName}, ${city}`
    : `Oferta — ${noun} ${city} | ${siteName}`;
  const meta = baseMetaInput({
    path: "/oferta",
    title,
    description: `Pełna oferta usług: ${clientConfig.services
      .map((s) => s.name)
      .join(", ")}. ${clientConfig.business.tagline}.`,
  });
  return {
    meta,
    jsonLd: [
      buildLocalBusinessJsonLd(),
      breadcrumbSchema([
        { name: "Strona główna", url: canonicalUrl("/") },
        { name: "Oferta", url: canonicalUrl("/oferta") },
      ]),
    ],
  };
}

/** O firmie page — LocalBusiness + WebPage + Breadcrumb. */
export function oFirmieSeo(): PageSeoBundle {
  const path = "/o-firmie";
  const city = clientConfig.location.address.city;
  const meta = baseMetaInput({
    path,
    title: `O nas — historia ${siteName} (${city})`,
    description:
      clientConfig.business.longDescription.slice(0, 155).trim() + "...",
  });

  const jsonLd: unknown[] = [
    buildLocalBusinessJsonLd(),
    webPageSchema({
      url: canonicalUrl(path),
      name: meta.title,
      description: meta.description,
      isPartOf: baseUrl,
      inLanguage: "pl-PL",
    }),
    breadcrumbSchema([
      { name: "Strona główna", url: canonicalUrl("/") },
      { name: "O firmie", url: canonicalUrl("/o-firmie") },
    ]),
  ];

  return { meta, jsonLd };
}

/** Kontakt page — LocalBusiness + Breadcrumb + FAQPage. */
export function kontaktSeo(faqs: ReadonlyArray<FaqItem> = []): PageSeoBundle {
  const path = "/kontakt";
  const city = clientConfig.location.address.city;
  const isRestaurant = clientConfig.business.schemaType === "Restaurant";
  const title = isRestaurant
    ? `Rezerwacja stolika — ${siteName}, ${city}`
    : `Kontakt — ${siteName}, ${city}`;
  const meta = baseMetaInput({
    path,
    title,
    description: `Skontaktuj się z ${siteName}. Telefon: ${clientConfig.contact.primaryPhone}. ${clientConfig.location.address.streetAddress}, ${city}.`,
  });

  const jsonLd: unknown[] = [
    buildLocalBusinessJsonLd(),
    breadcrumbSchema([
      { name: "Strona główna", url: canonicalUrl("/") },
      { name: "Kontakt", url: canonicalUrl("/kontakt") },
    ]),
  ];
  if (faqs.length > 0) {
    jsonLd.push(faqPageSchema({ url: canonicalUrl(path), items: faqs }));
  }

  return { meta, jsonLd };
}

/** Aktualności (blog index) — WebPage + Breadcrumb. */
export function aktualnosciSeo(): PageSeoBundle {
  const path = "/aktualnosci";
  const meta = baseMetaInput({
    path,
    title: `Aktualności — ${siteName}`,
    description: `Porady, nowości i wpisy od ${siteName}. ${clientConfig.business.tagline}.`,
    og: { type: "website", siteName },
  });
  return {
    meta,
    jsonLd: [
      webPageSchema({
        url: canonicalUrl(path),
        name: meta.title,
        description: meta.description,
        isPartOf: baseUrl,
        inLanguage: "pl-PL",
      }),
      breadcrumbSchema([
        { name: "Strona główna", url: canonicalUrl("/") },
        { name: "Aktualności", url: canonicalUrl("/aktualnosci") },
      ]),
    ],
  };
}

/** Single post — BlogPosting + Breadcrumb + Organization (publisher). */
export interface PostSeoInput {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO
  dateModified?: string;
  coverImage?: string; // path or full URL
  tags?: readonly string[];
}

export function postSeo(post: PostSeoInput): PageSeoBundle {
  const path = `/aktualnosci/${post.slug}`;
  const url = canonicalUrl(path);
  const absImage = post.coverImage
    ? post.coverImage.startsWith("http")
      ? post.coverImage
      : `${baseUrl}${post.coverImage.startsWith("/") ? "" : "/"}${post.coverImage}`
    : undefined;

  const meta = baseMetaInput({
    path,
    title: `${post.title} — ${siteName}`,
    description: post.description,
    og: {
      type: "article",
      siteName,
      ...(absImage && { image: { url: absImage } }),
    },
  });

  const articleInput: ArticleInput = {
    type: "BlogPosting",
    url,
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    author: { type: "Organization", name: siteName, url: baseUrl },
    publisher: { name: siteName },
    inLanguage: "pl-PL",
  };
  if (post.dateModified) articleInput.dateModified = post.dateModified;
  if (absImage) articleInput.image = { url: absImage };
  if (post.tags && post.tags.length > 0) articleInput.keywords = post.tags;

  return {
    meta,
    jsonLd: [
      articleSchema(articleInput),
      breadcrumbSchema([
        { name: "Strona główna", url: canonicalUrl("/") },
        { name: "Aktualności", url: canonicalUrl("/aktualnosci") },
        { name: post.title },
      ]),
    ],
  };
}

/** FAQ page — FAQPage + Breadcrumb + LocalBusiness. */
export function faqSeo(faqs: ReadonlyArray<FaqItem>): PageSeoBundle {
  const path = "/faq";
  const meta = baseMetaInput({
    path,
    title: `Najczęściej zadawane pytania — ${siteName}`,
    description: `Odpowiedzi na najczęściej zadawane pytania klientów ${siteName}.`,
  });
  const jsonLd: unknown[] = [
    buildLocalBusinessJsonLd(),
    breadcrumbSchema([
      { name: "Strona główna", url: canonicalUrl("/") },
      { name: "FAQ", url: canonicalUrl("/faq") },
    ]),
  ];
  if (faqs.length > 0) {
    jsonLd.push(faqPageSchema({ url: canonicalUrl(path), items: faqs }));
  }
  return { meta, jsonLd };
}

/** Programmatic service × location page — LocalBusiness + Service + FAQPage + Breadcrumb. */
export interface ProgrammaticSeoInput {
  path: string; // e.g. /uslugi/awaryjne-otwieranie-zamkow/rzeszow
  title: string;
  description: string;
  h1: string;
  serviceName: string;
  serviceSlug: string;
  locationName: string;
  faqs: ReadonlyArray<FaqItem>;
  body?: string;
}

export function programmaticSeo(input: ProgrammaticSeoInput): PageSeoBundle {
  const url = canonicalUrl(input.path);
  const meta = baseMetaInput({
    path: input.path,
    title: input.title,
    description: input.description,
  });

  const jsonLd: unknown[] = [
    buildLocalBusinessJsonLd(),
    webPageSchema({
      url,
      name: input.title,
      description: input.description,
      isPartOf: baseUrl,
      inLanguage: "pl-PL",
    }),
    breadcrumbSchema([
      { name: "Strona główna", url: canonicalUrl("/") },
      { name: "Usługi", url: canonicalUrl("/uslugi") },
      { name: input.serviceName, url: canonicalUrl(`/uslugi/${input.serviceSlug}`) },
      { name: input.locationName },
    ]),
  ];
  if (input.faqs.length > 0) {
    jsonLd.push(faqPageSchema({ url, items: input.faqs }));
  }
  return { meta, jsonLd };
}

/** /uslugi hub index — WebPage + Breadcrumb. */
export function uslugiHubSeo(): PageSeoBundle {
  const path = "/uslugi";
  const meta = baseMetaInput({
    path,
    title: `Usługi — ${siteName}`,
    description: `Pełna mapa usług ${siteName} z podziałem na miejscowości: ${clientConfig.location.serviceArea.join(", ")}. ${clientConfig.business.tagline}.`,
  });
  return {
    meta,
    jsonLd: [
      webPageSchema({
        url: canonicalUrl(path),
        name: meta.title,
        description: meta.description,
        isPartOf: baseUrl,
        inLanguage: "pl-PL",
      }),
      breadcrumbSchema([
        { name: "Strona główna", url: canonicalUrl("/") },
        { name: "Usługi", url: canonicalUrl("/uslugi") },
      ]),
    ],
  };
}

/** Generic 404 — no JSON-LD, just meta. */
export function notFoundSeo(): PageSeoBundle {
  return {
    meta: baseMetaInput({
      path: "/404",
      title: `Strona nie znaleziona — ${siteName}`,
      description: "Strona której szukasz nie istnieje lub została przeniesiona.",
      robots: { noindex: true, nofollow: true },
    }),
    jsonLd: [],
  };
}

/** Build breadcrumb items pair (utility for components). */
export function breadcrumbItems(current: string): BreadcrumbItemInput[] {
  return [
    { name: "Strona główna", url: canonicalUrl("/") },
    { name: current },
  ];
}
