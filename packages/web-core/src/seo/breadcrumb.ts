/**
 * BreadcrumbList JSON-LD builder.
 *
 * Use on every non-home page. Google shows breadcrumbs in SERP instead of full URL,
 * which significantly improves CTR for deep pages.
 */

import type { BreadcrumbItemInput } from "./types.js";
import { SCHEMA_CONTEXT } from "./types.js";

export interface BreadcrumbListJsonLd {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: ListItemJsonLd[];
}

export interface ListItemJsonLd {
  "@type": "ListItem";
  position: number;
  name: string;
  item?: string;
}

/**
 * Build BreadcrumbList JSON-LD.
 *
 * Convention:
 *   - 1st item: "Strona główna" (home)
 *   - last item: current page, item URL omitted (Google guidance)
 *   - position is 1-indexed
 *
 * @example
 *   breadcrumbSchema([
 *     { name: "Strona główna", url: "https://klient.pl/" },
 *     { name: "Oferta", url: "https://klient.pl/oferta" },
 *     { name: "Awaryjne otwieranie zamków" },  // current — no url
 *   ])
 */
export function breadcrumbSchema(items: ReadonlyArray<BreadcrumbItemInput>): BreadcrumbListJsonLd {
  if (items.length === 0) {
    throw new Error("breadcrumbSchema: at least one item required");
  }
  if (items.length === 1) {
    throw new Error("breadcrumbSchema: breadcrumbs of length 1 are useless — omit instead");
  }
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => {
      const out: ListItemJsonLd = {
        "@type": "ListItem",
        position: idx + 1,
        name: item.name,
      };
      if (item.url) out.item = item.url;
      return out;
    }),
  };
}
