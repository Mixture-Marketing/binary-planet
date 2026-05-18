/**
 * Sitemap.xml + sitemap-index builders.
 *
 * Used at build time in mm-starter — generuje sitemap.xml dla klienta na podstawie listy
 * URLs (z routerów Astro + dynamicznych stron programatycznych).
 *
 * Limity (sitemaps.org spec):
 *  - Pojedynczy sitemap: max 50,000 URLs lub 50MB (uncompressed)
 *  - Po przekroczeniu — sitemap-index z wieloma sub-sitemaps
 *  - Dla naszego scale (40 stron / klient max) — jeden sitemap wystarczy
 */

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface SitemapEntry {
  /** Absolute URL, must include scheme + host. */
  loc: string;
  /** ISO 8601 date — last modified. Recommended for crawler hints. */
  lastmod?: string;
  /** Crawler hint. Optional. */
  changefreq?: ChangeFreq;
  /** Relative priority 0.0–1.0. Optional, mostly ignored by Google. */
  priority?: number;
}

export interface SitemapOptions {
  /**
   * Pretty-print with newlines + indentation.
   * Useful in dev, slightly larger in prod. Default: true (sitemap files are small).
   */
  pretty?: boolean;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Build a single sitemap.xml from a list of entries. */
export function buildSitemap(entries: readonly SitemapEntry[], options: SitemapOptions = {}): string {
  if (entries.length === 0) throw new Error("buildSitemap: entries must not be empty");
  if (entries.length > 50_000) {
    throw new Error("buildSitemap: too many entries (max 50,000) — use buildSitemapIndex");
  }
  for (const e of entries) {
    validateEntry(e);
  }

  const pretty = options.pretty ?? true;
  const indent = pretty ? "  " : "";
  const nl = pretty ? "\n" : "";

  const urls = entries
    .map((e) => {
      const parts: string[] = [`${indent}<url>`];
      parts.push(`${indent}${indent}<loc>${escapeXml(e.loc)}</loc>`);
      if (e.lastmod !== undefined) parts.push(`${indent}${indent}<lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq !== undefined) {
        parts.push(`${indent}${indent}<changefreq>${e.changefreq}</changefreq>`);
      }
      if (e.priority !== undefined) {
        parts.push(`${indent}${indent}<priority>${e.priority.toFixed(1)}</priority>`);
      }
      parts.push(`${indent}</url>`);
      return parts.join(nl);
    })
    .join(nl);

  return `${XML_HEADER}${nl}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${nl}${urls}${nl}</urlset>`;
}

export interface SitemapIndexEntry {
  /** Absolute URL of a sub-sitemap. */
  loc: string;
  /** ISO 8601 date. */
  lastmod?: string;
}

/**
 * Build a sitemap-index.xml pointing to multiple sub-sitemaps.
 * Use when you have more than 50,000 URLs OR want logical splits
 * (e.g. /sitemap-pages.xml, /sitemap-blog.xml, /sitemap-services.xml).
 */
export function buildSitemapIndex(
  entries: readonly SitemapIndexEntry[],
  options: SitemapOptions = {},
): string {
  if (entries.length === 0) throw new Error("buildSitemapIndex: entries must not be empty");
  if (entries.length > 50_000) {
    throw new Error("buildSitemapIndex: too many sitemaps (max 50,000)");
  }
  for (const e of entries) {
    if (!isAbsoluteUrl(e.loc)) {
      throw new Error(`Sitemap entry loc must be absolute URL: "${e.loc}"`);
    }
  }

  const pretty = options.pretty ?? true;
  const indent = pretty ? "  " : "";
  const nl = pretty ? "\n" : "";

  const sitemaps = entries
    .map((e) => {
      const parts: string[] = [`${indent}<sitemap>`];
      parts.push(`${indent}${indent}<loc>${escapeXml(e.loc)}</loc>`);
      if (e.lastmod !== undefined) parts.push(`${indent}${indent}<lastmod>${e.lastmod}</lastmod>`);
      parts.push(`${indent}</sitemap>`);
      return parts.join(nl);
    })
    .join(nl);

  return `${XML_HEADER}${nl}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${nl}${sitemaps}${nl}</sitemapindex>`;
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

function validateEntry(e: SitemapEntry): void {
  if (!isAbsoluteUrl(e.loc)) {
    throw new Error(`Sitemap entry loc must be absolute URL: "${e.loc}"`);
  }
  if (e.priority !== undefined && (e.priority < 0 || e.priority > 1)) {
    throw new Error(`Sitemap entry priority must be 0.0–1.0, got ${e.priority} for ${e.loc}`);
  }
  if (e.lastmod !== undefined && !isIsoDate(e.lastmod)) {
    throw new Error(`Sitemap entry lastmod must be ISO 8601 date, got "${e.lastmod}"`);
  }
}

function isAbsoluteUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function isIsoDate(s: string): boolean {
  // Accept full ISO 8601 (date or datetime). Loose check sufficient for sitemap context.
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(s);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
