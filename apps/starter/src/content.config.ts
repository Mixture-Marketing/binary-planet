/**
 * Astro content collections — Sveltia-editable content.
 *
 * Source of truth lives in /content/ at repo root. Sveltia CMS edits these files
 * via commits to git. Astro reads them at build (and at request time in SSR).
 *
 * Three collections + one singleton:
 *   - posts:    blog / "aktualności"
 *   - faq:      multi-entry Q&A (rendered on FAQ page)
 *   - gallery:  image gallery
 *   - site:     singleton overrides (promo banner, hero override)
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

export const collections = { posts, faq, gallery, site };
