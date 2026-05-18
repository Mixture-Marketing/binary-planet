/**
 * Hreflang link tag builder for multi-language / multi-region sites.
 *
 * Critical when same content exists in multiple language versions — tells Google
 * which version to show per user locale. Mistakes here (mismatched, missing x-default)
 * cause significant SEO problems.
 *
 * Rules (Google docs):
 *   - Each language version must link to ALL other versions INCLUDING itself
 *   - hreflang values: BCP 47 language tags ("pl", "pl-PL", "en-US")
 *   - Special "x-default" — fallback for unmatched users (usually English landing)
 *   - Bidirectional consistency: if A links to B, B MUST link back to A
 */

import type { MetaTag } from "./meta.js";

export interface HreflangAlternate {
  /** BCP 47 language code, e.g. "pl", "pl-PL", "en-US", "x-default". */
  hreflang: string;
  /** Absolute URL of the alternate version. */
  href: string;
}

/**
 * Build <link rel="alternate" hreflang="..." href="..."> tags.
 *
 * Validates:
 *   - At least 2 alternates (otherwise pointless)
 *   - Each URL is absolute
 *   - "x-default" recommended (warning if absent)
 *
 * @example
 *   buildHreflangTags([
 *     { hreflang: "pl-PL", href: "https://example.pl/" },
 *     { hreflang: "en-US", href: "https://example.com/" },
 *     { hreflang: "x-default", href: "https://example.com/" },
 *   ])
 */
export function buildHreflangTags(alternates: ReadonlyArray<HreflangAlternate>): {
  tags: MetaTag[];
  warnings: string[];
} {
  const warnings: string[] = [];

  if (alternates.length < 2) {
    warnings.push(`hreflang with <2 alternates is pointless — got ${alternates.length}`);
  }

  const langs = alternates.map((a) => a.hreflang);
  const dupes = langs.filter((l, i) => langs.indexOf(l) !== i);
  if (dupes.length > 0) {
    warnings.push(`Duplicate hreflang values: ${[...new Set(dupes)].join(", ")}`);
  }

  if (!langs.includes("x-default")) {
    warnings.push(`Missing "x-default" — recommended fallback for unmatched users`);
  }

  for (const alt of alternates) {
    if (!/^https?:\/\//i.test(alt.href)) {
      warnings.push(`hreflang href must be absolute: "${alt.href}"`);
    }
    if (!isValidHreflangCode(alt.hreflang)) {
      warnings.push(`hreflang code looks invalid: "${alt.hreflang}" (expected BCP 47 or "x-default")`);
    }
  }

  const tags: MetaTag[] = alternates.map((alt) => ({
    kind: "link",
    rel: "alternate",
    href: alt.href,
    hreflang: alt.hreflang,
  }));

  return { tags, warnings };
}

/**
 * BCP 47 language tag validation. Permissive — accepts:
 *   - "pl", "en", "de" (2-letter language)
 *   - "pl-PL", "en-US" (lang-region)
 *   - "zh-Hant-HK" (lang-script-region)
 *   - "x-default" (Google extension)
 */
export function isValidHreflangCode(code: string): boolean {
  if (code === "x-default") return true;
  // Strict BCP 47: lowercase lang [+ optional Title-case 4-letter script] [+ optional UPPERCASE region]
  return /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(code);
}

/**
 * Verify bidirectional consistency across a set of pages.
 * Returns error array (empty = consistent).
 *
 * @example
 *   const pages = [
 *     { url: "https://example.pl/oferta", alternates: [{hreflang: "pl-PL", href: "..."}, {hreflang: "en-US", href: "..."}] },
 *     { url: "https://example.com/offer", alternates: [{hreflang: "pl-PL", href: "..."}, {hreflang: "en-US", href: "..."}] },
 *   ];
 *   verifyHreflangConsistency(pages);  // [] if consistent
 */
export interface HreflangPage {
  url: string;
  alternates: ReadonlyArray<HreflangAlternate>;
}

export function verifyHreflangConsistency(pages: ReadonlyArray<HreflangPage>): string[] {
  const errors: string[] = [];

  for (const page of pages) {
    // Page must include itself in its own alternates (self-reference rule)
    const selfRef = page.alternates.some((a) => a.href === page.url);
    if (!selfRef) {
      errors.push(`Page ${page.url} missing self-reference in alternates`);
    }

    // For each alternate URL, the corresponding page must link back
    for (const alt of page.alternates) {
      if (alt.hreflang === "x-default") continue;
      if (alt.href === page.url) continue;
      const targetPage = pages.find((p) => p.url === alt.href);
      if (!targetPage) continue; // not in our set — can't verify
      const linksBack = targetPage.alternates.some((a) => a.href === page.url);
      if (!linksBack) {
        errors.push(`Asymmetric: ${page.url} links to ${alt.href} but not vice versa`);
      }
    }
  }
  return errors;
}
