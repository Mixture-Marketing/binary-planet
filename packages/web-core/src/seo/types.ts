/**
 * Shared SEO types — used by meta tags, JSON-LD builders, hreflang.
 *
 * LocalBusiness + 15 subtypes live in @mixturemarketing/web-core/local (separate module).
 * This module covers everything else: Article, Organization, Breadcrumb, FAQ, WebSite, WebPage.
 */

/**
 * Person — author, reviewer, contact. schema.org/Person subset.
 */
export interface PersonInput {
  name: string;
  /** Profile URL (homepage, LinkedIn, etc.). Becomes Person.url. */
  url?: string;
  /** Avatar / headshot URL. */
  image?: string;
  /** Job title — used for E-E-A-T signals on blog posts. */
  jobTitle?: string;
  /** Same-as URLs (LinkedIn, Twitter) — Google entity verification. */
  sameAs?: readonly string[];
}

export interface PersonJsonLd {
  "@type": "Person";
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
}

/**
 * ImageObject input — used for og:image + JSON-LD image properties.
 * For Articles, Google prefers explicit width/height.
 */
export interface ImageObjectInput {
  url: string;
  width?: number;
  height?: number;
  /** Alt text — important for a11y AND SEO. */
  alt?: string;
  /** Caption — used in some article layouts. */
  caption?: string;
}

export interface ImageObjectJsonLd {
  "@type": "ImageObject";
  url: string;
  width?: number;
  height?: number;
  caption?: string;
}

/**
 * ListItem — used in BreadcrumbList (position + item URL).
 */
export interface BreadcrumbItemInput {
  /** Display name, e.g. "Strona główna", "Oferta". */
  name: string;
  /** Absolute URL. Omit for the last (current) item. */
  url?: string;
}

/**
 * Validation helpers — regex constants exported for re-use in client.config validators.
 */
export const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;
export const httpsUrlRegex = /^https?:\/\/[^\s]+$/;

/**
 * Common @context for JSON-LD. Always "https://schema.org".
 */
export const SCHEMA_CONTEXT = "https://schema.org" as const;
