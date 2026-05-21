/**
 * Lightweight HTML scraper for Workers runtime (no DOM, regex-based).
 *
 * Used by Track 24f-9 site migration: discover URLs from sitemap + fetch each page +
 * extract title, meta description, h1, body text (first 3000 chars).
 *
 * NOT a general-purpose parser — designed for static-ish content sites (most
 * mikrofirma websites). Doesn't execute JS, doesn't follow client-side routes.
 */

export interface ScrapedPage {
  url: string;
  status: number;
  title?: string;
  description?: string;
  h1?: string;
  bodyText?: string;
  word_count: number;
  /** Internal links found on this page (for crawling). */
  internal_links: string[];
  error?: string;
}

const HTML_TAGS_RE = /<(?:script|style|noscript|svg|iframe|nav|header|footer)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|iframe|nav|header|footer)>/gi;
const ANY_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_DESC_RE = /<meta\s+(?:[^>]*?)name=["']description["']\s+content=["']([^"']+)["']/i;
const META_DESC_RE_REV = /<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)name=["']description["']/i;
const H1_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
const LINK_RE = /<a\s+(?:[^>]*?)href=["']([^"']+)["']/gi;
const SITEMAP_LOC_RE = /<loc>([\s\S]*?)<\/loc>/gi;

/**
 * Fetch + parse a single page.
 * Returns extracted metadata + body text (max 3000 chars).
 */
export async function scrapePage(url: string, opts: { baseUrl?: string; timeout_ms?: number } = {}): Promise<ScrapedPage> {
  const baseUrl = opts.baseUrl ?? new URL(url).origin;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout_ms ?? 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "MixtureMarketing-MigrationBot/1.0 (+https://mixturemarketing.pl)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const status = res.status;
    if (!res.ok) {
      return { url, status, internal_links: [], word_count: 0, error: `HTTP ${status}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      return { url, status, internal_links: [], word_count: 0, error: `Non-HTML content (${ct})` };
    }
    const html = (await res.text()).slice(0, 500_000); // safety cap 500 KB
    return extractFromHtml(url, status, html, baseUrl);
  } catch (e) {
    return {
      url,
      status: 0,
      internal_links: [],
      word_count: 0,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractFromHtml(url: string, status: number, html: string, baseUrl: string): ScrapedPage {
  const titleMatch = html.match(TITLE_RE);
  const descMatch = html.match(META_DESC_RE) ?? html.match(META_DESC_RE_REV);
  const h1Match = html.match(H1_RE);

  // Strip ALL non-content tags, then strip remaining tags, normalize whitespace
  const bodyStripped = html
    .replace(HTML_TAGS_RE, " ")
    .replace(ANY_TAG_RE, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(WHITESPACE_RE, " ")
    .trim();

  const bodyText = bodyStripped.slice(0, 3000);
  const wordCount = bodyStripped.split(/\s+/).length;

  // Internal links
  const internalLinks = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(html)) !== null && internalLinks.size < 100) {
    const href = m[1]!;
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    let resolved: string;
    try {
      resolved = new URL(href, url).href;
    } catch { continue; }
    if (!resolved.startsWith(baseUrl)) continue;
    // Drop fragment
    const hashIdx = resolved.indexOf("#");
    if (hashIdx > 0) resolved = resolved.slice(0, hashIdx);
    if (resolved !== url) internalLinks.add(resolved);
  }

  return {
    url,
    status,
    ...(titleMatch?.[1] && { title: decodeEntities(titleMatch[1].trim()).slice(0, 250) }),
    ...(descMatch?.[1] && { description: decodeEntities(descMatch[1]).slice(0, 500) }),
    ...(h1Match?.[1] && { h1: decodeEntities(stripTags(h1Match[1])).slice(0, 250) }),
    bodyText,
    word_count: wordCount,
    internal_links: Array.from(internalLinks),
  };
}

function stripTags(s: string): string {
  return s.replace(ANY_TAG_RE, "").replace(WHITESPACE_RE, " ").trim();
}

function decodeEntities(s: string): string {
  const map: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  };
  return s.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => map[m] ?? m);
}

/**
 * Discover URLs from sitemap.xml. Returns up to maxUrls.
 * Falls back to homepage crawling if no sitemap found.
 */
export async function discoverUrls(baseUrl: string, opts: { maxUrls?: number } = {}): Promise<string[]> {
  const maxUrls = opts.maxUrls ?? 50;
  const candidates = [`${baseUrl}/sitemap.xml`, `${baseUrl}/sitemap_index.xml`, `${baseUrl}/sitemap-index.xml`];
  const urls = new Set<string>();
  for (const sm of candidates) {
    try {
      const res = await fetch(sm, { headers: { "User-Agent": "MixtureMarketing-MigrationBot/1.0" } });
      if (!res.ok) continue;
      const xml = (await res.text()).slice(0, 2_000_000); // 2 MB cap
      let m: RegExpExecArray | null;
      while ((m = SITEMAP_LOC_RE.exec(xml)) !== null && urls.size < maxUrls) {
        const loc = m[1]!.trim();
        // If loc is another sitemap (index), fetch it too (1 level deep only)
        if (loc.endsWith(".xml")) {
          try {
            const sub = await fetch(loc);
            if (sub.ok) {
              const subXml = await sub.text();
              let n: RegExpExecArray | null;
              while ((n = SITEMAP_LOC_RE.exec(subXml)) !== null && urls.size < maxUrls) {
                if (n[1]) urls.add(n[1].trim());
              }
            }
          } catch { /* skip */ }
        } else {
          urls.add(loc);
        }
      }
      if (urls.size > 0) break; // got something from this sitemap
    } catch { /* try next */ }
  }

  // No sitemap → crawl homepage + first 50 links
  if (urls.size === 0) {
    const home = await scrapePage(baseUrl);
    urls.add(baseUrl);
    for (const link of home.internal_links.slice(0, maxUrls - 1)) {
      urls.add(link);
    }
  }

  return Array.from(urls).slice(0, maxUrls);
}
