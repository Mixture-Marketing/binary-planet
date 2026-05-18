/**
 * WebPage JSON-LD builder (generic).
 *
 * Use sparingly — for most service-business pages, LocalBusiness + Breadcrumb is enough.
 * WebPage is useful when:
 *   - Page is review-worthy (reviewedBy + lastReviewed for E-E-A-T)
 *   - Page is part of a defined collection (isPartOf → WebSite)
 *   - Page has explicit primaryImageOfPage
 *
 * For pages with a clear semantic type (Article, FAQPage, etc.) use those instead.
 */

import type { ImageObjectInput, ImageObjectJsonLd, PersonInput, PersonJsonLd } from "./types.js";
import { SCHEMA_CONTEXT } from "./types.js";

export interface WebPageInput {
  /** Page URL — used as @id. */
  url: string;
  /** Page title. */
  name: string;
  description?: string;
  /** ISO date last reviewed by editor. */
  lastReviewed?: string;
  /** Person who reviewed the content. */
  reviewedBy?: PersonInput;
  /** Primary image on the page. */
  primaryImage?: ImageObjectInput;
  /** Parent site URL (typically WebSite @id). */
  isPartOf?: string;
  /** Breadcrumb URL — if you've also emitted BreadcrumbList separately. */
  breadcrumb?: string;
  inLanguage?: string;
  /** Speakable selectors (CSS) — for voice assistants to read content sections. */
  speakable?: ReadonlyArray<string>;
}

export interface WebPageJsonLd {
  "@context": "https://schema.org";
  "@type": "WebPage";
  "@id": string;
  url: string;
  name: string;
  description?: string;
  lastReviewed?: string;
  reviewedBy?: PersonJsonLd;
  primaryImageOfPage?: ImageObjectJsonLd;
  isPartOf?: { "@id": string };
  breadcrumb?: { "@id": string };
  inLanguage?: string;
  speakable?: {
    "@type": "SpeakableSpecification";
    cssSelector: string[];
  };
}

export function webPageSchema(input: WebPageInput): WebPageJsonLd {
  if (!input.name.trim()) throw new Error("webPageSchema: name required");

  const out: WebPageJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebPage",
    "@id": input.url,
    url: input.url,
    name: input.name,
  };

  if (input.description) out.description = input.description;
  if (input.lastReviewed) out.lastReviewed = input.lastReviewed;
  if (input.reviewedBy) {
    const p = input.reviewedBy;
    const person: PersonJsonLd = { "@type": "Person", name: p.name };
    if (p.url) person.url = p.url;
    if (p.image) person.image = p.image;
    if (p.jobTitle) person.jobTitle = p.jobTitle;
    if (p.sameAs?.length) person.sameAs = [...p.sameAs];
    out.reviewedBy = person;
  }
  if (input.primaryImage) {
    const img: ImageObjectJsonLd = { "@type": "ImageObject", url: input.primaryImage.url };
    if (input.primaryImage.width !== undefined) img.width = input.primaryImage.width;
    if (input.primaryImage.height !== undefined) img.height = input.primaryImage.height;
    if (input.primaryImage.caption) img.caption = input.primaryImage.caption;
    out.primaryImageOfPage = img;
  }
  if (input.isPartOf) out.isPartOf = { "@id": input.isPartOf };
  if (input.breadcrumb) out.breadcrumb = { "@id": input.breadcrumb };
  if (input.inLanguage) out.inLanguage = input.inLanguage;
  if (input.speakable?.length) {
    out.speakable = {
      "@type": "SpeakableSpecification",
      cssSelector: [...input.speakable],
    };
  }

  return out;
}
