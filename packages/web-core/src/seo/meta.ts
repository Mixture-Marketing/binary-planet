/**
 * Meta tag builder. Returns structured list of tags (renderer-agnostic).
 *
 * Astro: caller spreads `tags` array, renders each via `<meta {...tag} />` or `<link>`.
 * SSR: caller maps to HTML string via helper.
 *
 * Tag categories:
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical">
 *   - Open Graph (<meta property="og:*">)
 *   - Twitter Cards (<meta name="twitter:*">)
 *   - Robots meta (noindex/follow control)
 *   - Hreflang (delegated to hreflang.ts)
 */

import type { ImageObjectInput } from "./types.js";
import { httpsUrlRegex } from "./types.js";

export type TagKind = "title" | "meta" | "link";

export type MetaTag =
  | { kind: "title"; content: string }
  | { kind: "meta"; name?: string; property?: string; content: string }
  | { kind: "link"; rel: string; href: string; hreflang?: string; type?: string };

export interface MetaInput {
  /** Page title. ≤60 chars recommended (SERP truncation). */
  title: string;
  /** Description. 120-160 chars recommended. */
  description: string;
  /** Canonical URL — absolute. */
  canonicalUrl: string;
  /** Locale, default "pl_PL". */
  locale?: string;

  /** Open Graph. */
  og?: {
    /** og:type, e.g. "website" | "article" | "product". Default "website". */
    type?: string;
    /** Site name (brand). */
    siteName?: string;
    /** Override title for OG (default = main title). */
    title?: string;
    /** Override description for OG. */
    description?: string;
    /** Primary OG image. */
    image?: ImageObjectInput;
    /** Optional additional images. */
    additionalImages?: readonly ImageObjectInput[];
    /** For og:type=article — published date ISO. */
    publishedTime?: string;
    /** For og:type=article — modified date ISO. */
    modifiedTime?: string;
    /** For og:type=article — author name. */
    author?: string;
    /** For og:type=article — section. */
    section?: string;
    /** For og:type=article — tags. */
    tags?: readonly string[];
  };

  /** Twitter Cards. */
  twitter?: {
    /** "summary" | "summary_large_image". Default "summary_large_image" when og.image present, else "summary". */
    card?: string;
    /** @handle of site account. */
    site?: string;
    /** @handle of author. */
    creator?: string;
  };

  /** Robots meta. */
  robots?: {
    /** noindex — exclude from index. */
    noindex?: boolean;
    /** nofollow — don't follow links. */
    nofollow?: boolean;
    /** noarchive, nosnippet, etc. — additional directives. */
    extra?: readonly string[];
  };

  /** Favicon/icon links. */
  icons?: {
    /** SVG favicon (preferred — scales infinitely). */
    svg?: string;
    /** PNG 32x32 fallback. */
    png32?: string;
    /** Apple touch icon 180x180. */
    appleTouch?: string;
  };

  /** Theme color for mobile browser chrome. */
  themeColor?: string;
}

export interface MetaValidationError {
  field: string;
  message: string;
}

export interface BuildMetaResult {
  tags: MetaTag[];
  /** Soft validation warnings — caller can ignore, log, or fail build. */
  warnings: MetaValidationError[];
}

/**
 * Build complete meta tags list for a page.
 * Returns structured array — renderer-agnostic (Astro / React / SSR string).
 */
export function buildMetaTags(input: MetaInput): BuildMetaResult {
  const tags: MetaTag[] = [];
  const warnings: MetaValidationError[] = [];

  // Validation
  if (!httpsUrlRegex.test(input.canonicalUrl)) {
    warnings.push({ field: "canonicalUrl", message: `Should be absolute http(s) URL: "${input.canonicalUrl}"` });
  }
  if (input.title.length > 70) {
    warnings.push({ field: "title", message: `Title is ${input.title.length} chars — SERP truncates around 60-70` });
  }
  if (input.description.length < 120 || input.description.length > 160) {
    warnings.push({
      field: "description",
      message: `Description is ${input.description.length} chars — recommended 120-160`,
    });
  }

  // Title
  tags.push({ kind: "title", content: input.title });

  // Description
  tags.push({ kind: "meta", name: "description", content: input.description });

  // Canonical
  tags.push({ kind: "link", rel: "canonical", href: input.canonicalUrl });

  // Open Graph
  const og = input.og ?? {};
  const ogType = og.type ?? "website";
  const ogTitle = og.title ?? input.title;
  const ogDescription = og.description ?? input.description;
  const locale = input.locale ?? "pl_PL";

  tags.push({ kind: "meta", property: "og:type", content: ogType });
  tags.push({ kind: "meta", property: "og:title", content: ogTitle });
  tags.push({ kind: "meta", property: "og:description", content: ogDescription });
  tags.push({ kind: "meta", property: "og:url", content: input.canonicalUrl });
  tags.push({ kind: "meta", property: "og:locale", content: locale });
  if (og.siteName) tags.push({ kind: "meta", property: "og:site_name", content: og.siteName });

  if (og.image) {
    tags.push({ kind: "meta", property: "og:image", content: og.image.url });
    if (og.image.alt) tags.push({ kind: "meta", property: "og:image:alt", content: og.image.alt });
    if (og.image.width !== undefined) tags.push({ kind: "meta", property: "og:image:width", content: String(og.image.width) });
    if (og.image.height !== undefined) tags.push({ kind: "meta", property: "og:image:height", content: String(og.image.height) });
  }

  for (const img of og.additionalImages ?? []) {
    tags.push({ kind: "meta", property: "og:image", content: img.url });
  }

  // Article-specific OG
  if (ogType === "article") {
    if (og.publishedTime) tags.push({ kind: "meta", property: "article:published_time", content: og.publishedTime });
    if (og.modifiedTime) tags.push({ kind: "meta", property: "article:modified_time", content: og.modifiedTime });
    if (og.author) tags.push({ kind: "meta", property: "article:author", content: og.author });
    if (og.section) tags.push({ kind: "meta", property: "article:section", content: og.section });
    for (const tag of og.tags ?? []) {
      tags.push({ kind: "meta", property: "article:tag", content: tag });
    }
  }

  // Twitter Cards
  const twitter = input.twitter ?? {};
  const twitterCard = twitter.card ?? (og.image ? "summary_large_image" : "summary");
  tags.push({ kind: "meta", name: "twitter:card", content: twitterCard });
  tags.push({ kind: "meta", name: "twitter:title", content: ogTitle });
  tags.push({ kind: "meta", name: "twitter:description", content: ogDescription });
  if (og.image) {
    tags.push({ kind: "meta", name: "twitter:image", content: og.image.url });
    if (og.image.alt) tags.push({ kind: "meta", name: "twitter:image:alt", content: og.image.alt });
  }
  if (twitter.site) tags.push({ kind: "meta", name: "twitter:site", content: twitter.site });
  if (twitter.creator) tags.push({ kind: "meta", name: "twitter:creator", content: twitter.creator });

  // Robots
  if (input.robots) {
    const parts: string[] = [];
    if (input.robots.noindex) parts.push("noindex");
    else parts.push("index");
    if (input.robots.nofollow) parts.push("nofollow");
    else parts.push("follow");
    for (const extra of input.robots.extra ?? []) parts.push(extra);
    tags.push({ kind: "meta", name: "robots", content: parts.join(", ") });
  }

  // Icons
  if (input.icons?.svg) {
    tags.push({ kind: "link", rel: "icon", href: input.icons.svg, type: "image/svg+xml" });
  }
  if (input.icons?.png32) {
    tags.push({ kind: "link", rel: "icon", href: input.icons.png32, type: "image/png" });
  }
  if (input.icons?.appleTouch) {
    tags.push({ kind: "link", rel: "apple-touch-icon", href: input.icons.appleTouch });
  }

  // Theme color
  if (input.themeColor) {
    tags.push({ kind: "meta", name: "theme-color", content: input.themeColor });
  }

  return { tags, warnings };
}

/**
 * Render meta tags as HTML string (no React/Astro needed).
 * Useful for tests + SSR string builders that don't pipe through a framework.
 */
export function renderMetaTagsHtml(tags: ReadonlyArray<MetaTag>): string {
  return tags
    .map((tag) => {
      if (tag.kind === "title") return `<title>${escapeAttr(tag.content)}</title>`;
      if (tag.kind === "meta") {
        const attr = tag.name ? `name="${escapeAttr(tag.name)}"` : `property="${escapeAttr(tag.property ?? "")}"`;
        return `<meta ${attr} content="${escapeAttr(tag.content)}" />`;
      }
      // link
      const parts: string[] = [`rel="${escapeAttr(tag.rel)}"`, `href="${escapeAttr(tag.href)}"`];
      if (tag.hreflang) parts.push(`hreflang="${escapeAttr(tag.hreflang)}"`);
      if (tag.type) parts.push(`type="${escapeAttr(tag.type)}"`);
      return `<link ${parts.join(" ")} />`;
    })
    .join("\n");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
