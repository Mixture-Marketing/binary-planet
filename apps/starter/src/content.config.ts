/**
 * Astro content collections — Sveltia-editable content.
 *
 * Source of truth lives in /content/ at repo root. Sveltia CMS edits these files
 * via commits to git. Astro reads them at build (and at request time in SSR).
 *
 * Collections + singletons:
 *   - posts:        blog / "aktualności"
 *   - faq:          multi-entry Q&A (rendered on FAQ page)
 *   - gallery:      image gallery
 *   - team:         członkowie zespołu (X.6)
 *   - publications: artykuły / książki / wystąpienia (X.6 — Professional)
 *   - history:      singleton — historia firmy z drop cap + pull quote (X.6)
 *   - site:         singleton overrides (promo banner, hero override)
 *
 * Provisioning data (NAP, NIP, services list, hours) lives in client.config.ts
 * and is NOT edited via Sveltia — only via onboarding wizard / VA console.
 */

import { glob, file } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/posts" }),
  schema: z.object({
    title: z.string().min(1).max(180),
    date: z.coerce.date(),
    excerpt: z.string().max(300).optional(),
    coverImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    published: z.boolean().default(true),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/faq" }),
  schema: z.object({
    question: z.string().min(1).max(200),
    order: z.number().int().nonnegative().default(99),
    published: z.boolean().default(true),
  }),
});

const gallery = defineCollection({
  loader: glob({ pattern: "**/*.{md,json}", base: "./content/gallery" }),
  schema: z.object({
    image: z.string(),
    caption: z.string().max(200).optional(),
    order: z.number().int().nonnegative().default(99),
  }),
});

const site = defineCollection({
  // file() loader: parser must return an object keyed by entry id.
  // For singleton, we wrap the JSON under id "overrides" → getEntry("site", "overrides").
  loader: file("./content/site/overrides.json", {
    parser: (text) => ({ overrides: JSON.parse(text) }),
  }),
  schema: z.object({
    heroOverride: z
      .object({
        title: z.string().min(1).max(180).optional(),
        subtitle: z.string().max(300).optional(),
        image: z.string().optional(),
      })
      .nullable(),
    promoBanner: z.object({
      enabled: z.boolean(),
      text: z.string().max(160),
      ctaLabel: z.string().max(40),
      ctaHref: z.string(),
    }),
    announcementBar: z.object({
      enabled: z.boolean(),
      text: z.string().max(200),
    }),
  }),
});

const team = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/team" }),
  schema: z.object({
    name: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    bio: z.string().max(800).optional(),
    photo: z.string().optional(),
    order: z.number().int().nonnegative().default(99),
    published: z.boolean().default(true),
  }),
});

const publications = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/publications" }),
  schema: z.object({
    title: z.string().min(1).max(220),
    source: z.string().min(1).max(120),
    date: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/, "Format: YYYY, YYYY-MM lub YYYY-MM-DD"),
    url: z.string().url().optional(),
    type: z.enum(["article", "book", "interview", "speech", "podcast"]).optional(),
    order: z.number().int().nonnegative().default(99),
    published: z.boolean().default(true),
  }),
});

const history = defineCollection({
  // Singleton — 1 plik markdown z rich content + meta jako frontmatter.
  loader: glob({ pattern: "main.md", base: "./content/history" }),
  schema: z.object({
    heading: z.string().min(1).max(200).optional(),
    pullQuote: z.string().max(400).optional(),
    authorByline: z.string().max(120).optional(),
    dropCap: z.boolean().default(false),
    imageUrl: z.string().optional(),
    imageCaption: z.string().max(200).optional(),
    ornament: z.enum([
      "none", "divider-3-dots", "divider-diamond", "divider-fleuron",
      "divider-asterism", "divider-hairline",
    ]).default("none"),
  }),
});

export const collections = { posts, faq, gallery, team, publications, history, site };
