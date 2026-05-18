/**
 * WebSite JSON-LD builder. Single root entity for the site.
 *
 * Goes ONCE on the home page (not per-page). Establishes site identity + optional sitelink
 * search box (potentialAction=SearchAction).
 *
 * Google uses this to:
 *   - Identify the canonical site name (replaces autodetected name in SERP)
 *   - Enable sitelink search box (if SearchAction provided + manually verified in GSC)
 */

import { SCHEMA_CONTEXT } from "./types.js";

export interface WebSiteInput {
  url: string;
  name: string;
  /** Short alternate name — used in some SERPs when full name too long. */
  alternateName?: string;
  description?: string;
  /** Default language tag e.g. "pl-PL". */
  inLanguage?: string;
  /** Publisher (Organization) — optional anchor for E-E-A-T. */
  publisher?: { name: string; url?: string };
  /** Sitelink search box. URL pattern with {search_term_string} placeholder. */
  searchAction?: {
    /** Search URL template, e.g. "https://example.pl/szukaj?q={search_term_string}" */
    target: string;
    /** Query input parameter name in target URL. Default "search_term_string". */
    queryInput?: string;
  };
}

export interface WebSiteJsonLd {
  "@context": "https://schema.org";
  "@type": "WebSite";
  "@id": string;
  url: string;
  name: string;
  alternateName?: string;
  description?: string;
  inLanguage?: string;
  publisher?: { "@type": "Organization"; name: string; url?: string };
  potentialAction?: {
    "@type": "SearchAction";
    target: { "@type": "EntryPoint"; urlTemplate: string };
    "query-input": string;
  };
}

export function webSiteSchema(input: WebSiteInput): WebSiteJsonLd {
  if (!input.name.trim()) throw new Error("webSiteSchema: name required");
  if (!input.url.trim()) throw new Error("webSiteSchema: url required");

  const out: WebSiteJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": input.url,
    url: input.url,
    name: input.name,
  };

  if (input.alternateName) out.alternateName = input.alternateName;
  if (input.description) out.description = input.description;
  if (input.inLanguage) out.inLanguage = input.inLanguage;
  if (input.publisher) {
    const publisher: { "@type": "Organization"; name: string; url?: string } = {
      "@type": "Organization",
      name: input.publisher.name,
    };
    if (input.publisher.url) publisher.url = input.publisher.url;
    out.publisher = publisher;
  }

  if (input.searchAction) {
    const qi = input.searchAction.queryInput ?? "search_term_string";
    if (!input.searchAction.target.includes(`{${qi}}`)) {
      throw new Error(`webSiteSchema: searchAction.target must contain {${qi}} placeholder`);
    }
    out.potentialAction = {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: input.searchAction.target },
      "query-input": `required name=${qi}`,
    };
  }

  return out;
}
