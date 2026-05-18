/**
 * Comprehensive SEO bundle per page type.
 *
 * Pages call one of these to get all JSON-LD blocks + meta tag inputs in one shot.
 * Then BaseLayout consumes the result.
 */

import {
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  webPageSchema,
  webSiteSchema,
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

/** Shared meta defaults — pages override what's relevant. */
function baseMetaInput(overrides: Partial<MetaInput> & { path: string }): MetaInput {
  return {
    title: clientConfig.business.name,
    description: clientConfig.business.description,
    canonicalUrl: canonicalUrl(overrides.path),
    locale: "pl_PL",
    og: {
      type: "website",
      siteName,
      ...overrides.og,
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
    title: `${siteName} — ${clientConfig.location.address.city} | ${clientConfig.business.tagline}`,
    description: clientConfig.business.description,
  });
  return {
    meta,
    jsonLd: [buildLocalBusinessJsonLd(), buildWebSite(), buildOrganization()],
  };
}

/** Oferta page — LocalBusiness + Breadcrumb. */
export function ofertaSeo(): PageSeoBundle {
  const meta = baseMetaInput({
    path: "/oferta",
    title: `Oferta — ${siteName}`,
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
        { name: "Oferta" },
      ]),
    ],
  };
}

/** O firmie page — LocalBusiness + WebPage + Breadcrumb. */
export function oFirmieSeo(): PageSeoBundle {
  const path = "/o-firmie";
  const meta = baseMetaInput({
    path,
    title: `O firmie — ${siteName}`,
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
      { name: "O firmie" },
    ]),
  ];

  return { meta, jsonLd };
}

/** Kontakt page — LocalBusiness + Breadcrumb + FAQPage. */
export function kontaktSeo(faqs: ReadonlyArray<FaqItem> = []): PageSeoBundle {
  const path = "/kontakt";
  const meta = baseMetaInput({
    path,
    title: `Kontakt — ${siteName}`,
    description: `Skontaktuj się z ${siteName}. Telefon: ${clientConfig.contact.primaryPhone}. ${clientConfig.location.address.streetAddress}, ${clientConfig.location.address.city}.`,
  });

  const jsonLd: unknown[] = [
    buildLocalBusinessJsonLd(),
    breadcrumbSchema([
      { name: "Strona główna", url: canonicalUrl("/") },
      { name: "Kontakt" },
    ]),
  ];
  if (faqs.length > 0) {
    jsonLd.push(faqPageSchema({ url: canonicalUrl(path), items: faqs }));
  }

  return { meta, jsonLd };
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
