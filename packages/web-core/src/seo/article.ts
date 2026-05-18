/**
 * Article JSON-LD builder. Supports Article, BlogPosting, NewsArticle subtypes.
 *
 * Critical for blog content (Track 7 — AI blog) + news/case studies. Google rewards
 * properly marked-up articles with rich results (date, author, image).
 */

import type { ImageObjectInput, ImageObjectJsonLd, PersonInput, PersonJsonLd } from "./types.js";
import { SCHEMA_CONTEXT } from "./types.js";

export type ArticleType = "Article" | "BlogPosting" | "NewsArticle";

export interface ArticleInput {
  /** Sub-type. Default "Article". Use "BlogPosting" for blog, "NewsArticle" for time-sensitive content. */
  type?: ArticleType;
  /** Page URL — used as @id + mainEntityOfPage. */
  url: string;
  /** H1 / title — Google strongly prefers this matches OG title + meta title. */
  headline: string;
  /** Short summary. */
  description: string;
  /** ISO date — when first published. REQUIRED for NewsArticle, recommended for all. */
  datePublished: string;
  /** ISO date — when last meaningfully edited. Recommended for "freshness" signals. */
  dateModified?: string;
  /** Author (Person or Organization). Use Organization for editorial / brand content. */
  author: PersonInput | { name: string; url?: string; type: "Organization" };
  /** Publisher Organization — usually same as klient business. */
  publisher: { name: string; logo?: ImageObjectInput };
  /** Primary image (16:9 recommended, ≥1200px wide for AMP-style cards). */
  image?: ImageObjectInput;
  /** Optional additional images. */
  additionalImages?: readonly ImageObjectInput[];
  /** Article section / category, e.g. "Porady ślusarskie". */
  articleSection?: string;
  /** Keywords/tags. */
  keywords?: readonly string[];
  /** Word count of body content. */
  wordCount?: number;
  /** Locale, default "pl-PL". */
  inLanguage?: string;
  /** Optional articleBody plain text. Google can use as alt-source if HTML not crawlable. */
  articleBody?: string;
}

export interface ArticleJsonLd {
  "@context": "https://schema.org";
  "@type": ArticleType;
  "@id": string;
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: PersonJsonLd | { "@type": "Organization"; name: string; url?: string };
  publisher: {
    "@type": "Organization";
    name: string;
    logo?: ImageObjectJsonLd;
  };
  image?: ImageObjectJsonLd | string[];
  mainEntityOfPage: { "@type": "WebPage"; "@id": string };
  articleSection?: string;
  keywords?: string;
  wordCount?: number;
  inLanguage?: string;
  articleBody?: string;
}

export function articleSchema(input: ArticleInput): ArticleJsonLd {
  if (!input.headline.trim()) throw new Error("articleSchema: headline required");
  if (!input.description.trim()) throw new Error("articleSchema: description required");
  if (!input.datePublished) throw new Error("articleSchema: datePublished required");

  const type = input.type ?? "Article";

  const out: ArticleJsonLd = {
    "@context": SCHEMA_CONTEXT,
    "@type": type,
    "@id": input.url,
    url: input.url,
    headline: input.headline,
    description: input.description,
    datePublished: input.datePublished,
    author: buildAuthor(input.author),
    publisher: buildPublisher(input.publisher),
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
  };

  if (input.dateModified) out.dateModified = input.dateModified;
  if (input.articleSection) out.articleSection = input.articleSection;
  if (input.keywords?.length) out.keywords = input.keywords.join(", ");
  if (input.wordCount !== undefined) out.wordCount = input.wordCount;
  if (input.inLanguage) out.inLanguage = input.inLanguage;
  if (input.articleBody) out.articleBody = input.articleBody;

  if (input.image && (input.additionalImages?.length ?? 0) === 0) {
    out.image = buildImage(input.image);
  } else if (input.image && input.additionalImages?.length) {
    // Multi-image: emit as array of URLs (Google guide pattern)
    out.image = [input.image.url, ...input.additionalImages.map((i) => i.url)];
  } else if (!input.image && input.additionalImages?.length) {
    out.image = input.additionalImages.map((i) => i.url);
  }

  return out;
}

function buildAuthor(input: ArticleInput["author"]): ArticleJsonLd["author"] {
  if ("type" in input && input.type === "Organization") {
    const out: { "@type": "Organization"; name: string; url?: string } = {
      "@type": "Organization",
      name: input.name,
    };
    if (input.url) out.url = input.url;
    return out;
  }
  // Person
  const p = input as PersonInput;
  const out: PersonJsonLd = { "@type": "Person", name: p.name };
  if (p.url) out.url = p.url;
  if (p.image) out.image = p.image;
  if (p.jobTitle) out.jobTitle = p.jobTitle;
  if (p.sameAs?.length) out.sameAs = [...p.sameAs];
  return out;
}

function buildPublisher(
  input: ArticleInput["publisher"],
): ArticleJsonLd["publisher"] {
  const out: ArticleJsonLd["publisher"] = {
    "@type": "Organization",
    name: input.name,
  };
  if (input.logo) out.logo = buildImage(input.logo);
  return out;
}

function buildImage(input: ImageObjectInput): ImageObjectJsonLd {
  const out: ImageObjectJsonLd = { "@type": "ImageObject", url: input.url };
  if (input.width !== undefined) out.width = input.width;
  if (input.height !== undefined) out.height = input.height;
  if (input.caption) out.caption = input.caption;
  return out;
}
