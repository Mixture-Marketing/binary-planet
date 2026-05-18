# @mixturemarketing/web-core/seo

Meta tags + JSON-LD builders (Article, Organization, BreadcrumbList, FAQPage, WebSite, WebPage, hreflang).

**LocalBusiness + 15 subtypów** żyje w [`@mixturemarketing/web-core/local`](../local/) — to osobny moduł.

**Status:** Track L-seo done. 7 generatorów schema.org + meta + hreflang. **57 testów.**

## Quick start

### Meta tags w Astro

```astro
---
import { buildMetaTags } from "@mixturemarketing/web-core/seo";

const { tags, warnings } = buildMetaTags({
  title: "Ślusarz Kowalski Rzeszów — 24/7",
  description: "Awaryjne otwieranie zamków w Rzeszowie...",
  canonicalUrl: `https://${domain}/`,
  og: {
    type: "website",
    siteName: "Ślusarz Kowalski",
    image: { url: "https://...og.png", width: 1200, height: 630, alt: "..." },
  },
  twitter: { site: "@kowalski_slusarz" },
  icons: { svg: "/favicon.svg" },
  themeColor: "#c0392b",
});

// Log warnings during dev
if (import.meta.env.DEV) for (const w of warnings) console.warn(`SEO: ${w.field} — ${w.message}`);
---
{tags.map((tag) => {
  if (tag.kind === "title") return <title>{tag.content}</title>;
  if (tag.kind === "link") return <link rel={tag.rel} href={tag.href} hreflang={tag.hreflang} type={tag.type} />;
  return <meta name={tag.name} property={tag.property} content={tag.content} />;
})}
```

### JSON-LD

```ts
import {
  articleSchema,
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  webSiteSchema,
} from "@mixturemarketing/web-core/seo";

// Home page → WebSite + Organization
const homeJsonLd = [
  webSiteSchema({
    url: "https://kowalski.pl",
    name: "Ślusarz Kowalski",
    inLanguage: "pl-PL",
    searchAction: {
      target: "https://kowalski.pl/szukaj?q={search_term_string}",
    },
  }),
  organizationSchema({
    url: "https://kowalski.pl",
    name: "Ślusarz Kowalski",
    legalName: "Kowalski Jan",
    taxID: "8121234567",
    sameAs: ["https://facebook.com/kowalski"],
  }),
];

// Service page → Breadcrumb + FAQ
const serviceJsonLd = [
  breadcrumbSchema([
    { name: "Strona główna", url: "https://kowalski.pl/" },
    { name: "Oferta", url: "https://kowalski.pl/oferta" },
    { name: "Awaryjne otwieranie zamków" },
  ]),
  faqPageSchema({
    url: "https://kowalski.pl/uslugi/otwieranie-zamkow",
    items: [
      { question: "Ile czasu zajmuje?", answer: "5-15 minut." },
      { question: "Czy uszkodzą Państwo drzwi?", answer: "Nie." },
    ],
  }),
];

// Blog post → Article
const articleJsonLd = articleSchema({
  type: "BlogPosting",
  url: "https://kowalski.pl/blog/jak-dobrac-zamek",
  headline: "Jak dobrać zamek klasy B/C/C+",
  description: "Praktyczny przewodnik wyboru zamka.",
  datePublished: "2026-05-18",
  dateModified: "2026-05-19",
  author: { name: "Jan Kowalski", jobTitle: "Ślusarz" },
  publisher: { name: "Ślusarz Kowalski", logo: { url: "https://kowalski.pl/logo.png" } },
  image: { url: "https://kowalski.pl/blog/zamki.jpg", width: 1200, height: 630 },
  keywords: ["zamki", "bezpieczeństwo", "klasa C"],
  wordCount: 800,
});

// Render: <script type="application/ld+json" set:html={JSON.stringify(o)} />
```

### Hreflang (multi-language)

```ts
import { buildHreflangTags, verifyHreflangConsistency } from "@mixturemarketing/web-core/seo";

const { tags, warnings } = buildHreflangTags([
  { hreflang: "pl-PL", href: "https://example.pl/" },
  { hreflang: "en-US", href: "https://example.com/" },
  { hreflang: "x-default", href: "https://example.com/" },
]);
// → <link rel="alternate" hreflang="..." href="..." /> tags

// CI lint:
const errors = verifyHreflangConsistency([
  { url: "https://example.pl/", alternates: [...] },
  { url: "https://example.com/", alternates: [...] },
]);
if (errors.length > 0) throw new Error(errors.join("\n"));
```

## API surface

| Function | Returns | Purpose |
|----------|---------|---------|
| `buildMetaTags(input)` | `{tags, warnings}` | Title + description + canonical + OG + Twitter + robots + icons |
| `renderMetaTagsHtml(tags)` | `string` | HTML render (for tests / SSR string builders) |
| `articleSchema(input)` | `ArticleJsonLd` | Article / BlogPosting / NewsArticle |
| `organizationSchema(input)` | `OrganizationJsonLd` | Non-LocalBusiness organization |
| `breadcrumbSchema(items)` | `BreadcrumbListJsonLd` | BreadcrumbList with 1-indexed positions |
| `faqPageSchema(input)` | `FaqPageJsonLd` | FAQPage with Question/Answer entities |
| `webSiteSchema(input)` | `WebSiteJsonLd` | Site identity + sitelink SearchAction |
| `webPageSchema(input)` | `WebPageJsonLd` | Generic page schema |
| `buildHreflangTags(alts)` | `{tags, warnings}` | Multi-language link tags |
| `isValidHreflangCode(code)` | `boolean` | BCP 47 validation |
| `verifyHreflangConsistency(pages)` | `string[]` | CI lint for self-ref + symmetric linking |

## Rich result types this enables

| Schema type | Google rich result | Notes |
|------------|---------------------|-------|
| `Article` / `BlogPosting` | Article rich card (date, author, image) | Critical for blog |
| `BreadcrumbList` | Breadcrumb trail in SERP (instead of URL) | Improves CTR |
| `FAQPage` | Limited rollback Aug 2023 — still valuable for AI Overviews + Voice | All service pages |
| `Organization` | Knowledge Panel anchoring | Combined with sameAs |
| `WebSite` | Sitelink search box (with SearchAction + GSC verify) | Home page only |
| `WebPage` + `speakable` | Voice search snippets | Optional |
| LocalBusiness (in `/local`) | Local Pack + Google Maps | Critical for service business |

## Reference

- Plan: [00-main.md "Faza 1"](../../../../plan/00-main.md)
- Plan: [I-analytics.md](../../../../plan/I-analytics.md)
- Schema.org: https://schema.org/
- Google Rich Results: https://developers.google.com/search/docs/appearance/structured-data
- BCP 47 hreflang: https://developers.google.com/search/docs/specialty/international/localized-versions
