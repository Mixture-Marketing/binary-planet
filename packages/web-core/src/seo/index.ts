/**
 * @mixturemarketing/web-core/seo
 *
 * SEO meta tags + JSON-LD builders (everything except LocalBusiness).
 * LocalBusiness + 15 subtypes live in @mixturemarketing/web-core/local.
 *
 * Reference: plan/00-main.md "Faza 1", plan/I-analytics.md.
 *
 * Quick start:
 *   import { buildMetaTags, articleSchema, breadcrumbSchema, faqPageSchema,
 *            webSiteSchema, organizationSchema } from "@mixturemarketing/web-core/seo";
 *
 * Astro pattern:
 *   const { tags } = buildMetaTags({...});
 *   {tags.map(tag => ...render based on tag.kind...)}
 *
 *   const jsonLd = [articleSchema({...}), breadcrumbSchema([...])];
 *   {jsonLd.map(o => <script type="application/ld+json" set:html={JSON.stringify(o)} />)}
 */

export const MODULE_NAME = "seo" as const;

// Shared types
export type {
  PersonInput,
  PersonJsonLd,
  ImageObjectInput,
  ImageObjectJsonLd,
  BreadcrumbItemInput,
} from "./types.js";
export { SCHEMA_CONTEXT, isoDateRegex, httpsUrlRegex } from "./types.js";

// Meta tags
export { buildMetaTags, renderMetaTagsHtml } from "./meta.js";
export type { BuildMetaResult, MetaInput, MetaTag, MetaValidationError, TagKind } from "./meta.js";

// Article JSON-LD
export { articleSchema } from "./article.js";
export type { ArticleInput, ArticleJsonLd, ArticleType } from "./article.js";

// Organization JSON-LD
export { organizationSchema } from "./organization.js";
export type {
  ContactPointInput,
  ContactPointJsonLd,
  OrganizationInput,
  OrganizationJsonLd,
} from "./organization.js";

// Breadcrumb
export { breadcrumbSchema } from "./breadcrumb.js";
export type { BreadcrumbListJsonLd, ListItemJsonLd } from "./breadcrumb.js";

// FAQ
export { faqPageSchema } from "./faq.js";
export type { FaqInput, FaqItem, FaqPageJsonLd, QuestionJsonLd } from "./faq.js";

// WebSite
export { webSiteSchema } from "./website.js";
export type { WebSiteInput, WebSiteJsonLd } from "./website.js";

// WebPage
export { webPageSchema } from "./webpage.js";
export type { WebPageInput, WebPageJsonLd } from "./webpage.js";

// Hreflang
export { buildHreflangTags, isValidHreflangCode, verifyHreflangConsistency } from "./hreflang.js";
export type { HreflangAlternate, HreflangPage } from "./hreflang.js";
