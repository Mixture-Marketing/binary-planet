/**
 * Zod schema for client.config.ts. Build-time validation — Astro fails build if config invalid.
 *
 * Each klient repo has their own `client.config.ts` filled by provisioning workflow.
 * Schema is the contract: starter assumes these fields are present + well-formed.
 */

import {
  e164PhoneRegex,
  polishPostalCodeRegex,
  POLISH_VOIVODESHIPS,
  type LocalBusinessSubtype,
} from "@mixturemarketing/web-core/local";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Theme presets — Hybrid (Opcja C) STYLOWE (NIE branżowe). Track 26 round 3.
// Single source of truth for preset slugs + variants lives in themes/registry.ts.
//
// PL labels (UI klienta):
//   minimalist → Czysty
//   elegant    → Elegancki
//   dynamic    → Dynamiczny
//   editorial  → Magazynowy
// ---------------------------------------------------------------------------
export const THEME_PRESETS = ["minimalist", "elegant", "dynamic", "editorial"] as const;
export type ThemePresetSlug = (typeof THEME_PRESETS)[number];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const polishVoivodeshipTuple = [...POLISH_VOIVODESHIPS] as [
  (typeof POLISH_VOIVODESHIPS)[number],
  ...(typeof POLISH_VOIVODESHIPS)[number][],
];

const addressSchema = z.object({
  streetAddress: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  voivodeship: z.enum(polishVoivodeshipTuple),
  postalCode: z.string().regex(polishPostalCodeRegex, "Polish postal code must match NN-NNN"),
  country: z.string().regex(/^[A-Z]{2}$/).default("PL"),
});

const serviceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500),
  priceFrom: z.string().max(40).optional(), // "150 zł", "od 100 zł", "wycena indywidualna"
  iconKey: z.string().max(40).optional(),
});

const openingHoursSchema = z.object({
  monday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  tuesday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  wednesday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  thursday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  friday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  saturday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  sunday: z.tuple([z.string(), z.string()]).or(z.literal("closed")).optional(),
  /** Human-readable note shown alongside table, e.g. "Awaryjne wezwania 24/7". */
  note: z.string().max(200).optional(),
});

const integrationsSchema = z.object({
  plausible: z.boolean().default(true),
  ga4: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  metaPixel: z.string().regex(/^\d+$/).optional(),
  googleAdsConversionId: z.string().regex(/^AW-\d+$/).optional(),
  tiktokPixel: z.string().optional(),
  clarity: z.string().optional(),
  turnstileSiteKey: z.string().optional(),
  zaraz: z.boolean().default(false),
});

const reviewSchema = z.object({
  author: z.string().max(80),
  rating: z.number().int().min(1).max(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().max(800),
  source: z.enum(["gbp", "manual", "facebook"]).default("gbp"),
});

export const clientConfigSchema = z.object({
  // Identity (filled at provisioning)
  clientId: z.string().regex(/^clk_[a-z0-9_-]+$/),

  // Business identity (klient potwierdza w wizardzie krok 4)
  business: z.object({
    name: z.string().min(1).max(200),
    legalName: z.string().max(200).optional(),
    nip: z.string().regex(/^\d{10}$/),
    regon: z.string().regex(/^\d{9}(\d{5})?$/).optional(),
    krs: z.string().regex(/^\d{10}$/).optional(),
    industry: z.string().min(1).max(64),
    /** schema.org @type — must match a LocalBusinessSubtype. */
    schemaType: z.custom<LocalBusinessSubtype>((v) => typeof v === "string"),
    foundedYear: z.number().int().min(1900).max(2100).optional(),
    employeeCount: z.number().int().positive().max(10000).optional(),
    description: z.string().max(500),
    /** Long-form "o firmie" paragraph (markdown allowed). */
    longDescription: z.string().max(5000),
    /** USP / value proposition line (used in hero subtitle). */
    tagline: z.string().min(1).max(140),
  }),

  // Contact
  contact: z.object({
    primaryPhone: z
      .string()
      .regex(e164PhoneRegex, "phone must be E.164 e.g. +48171234567"),
    secondaryPhone: z.string().regex(e164PhoneRegex).optional(),
    email: z.string().email(),
    contactPersonName: z.string().max(100).optional(),
    /** Email used by Resend to forward leads (defaults to contact.email). */
    notificationEmail: z.string().email().optional(),
  }),

  // Address + service area
  location: z.object({
    address: addressSchema,
    geo: z
      .object({
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
      })
      .optional(),
    gbpPlaceId: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{20,}$/).optional(),
    /** Cities/districts klient obsługuje. */
    serviceArea: z.array(z.string().min(1).max(100)).min(1).max(50),
  }),

  // Services (oferta)
  services: z.array(serviceSchema).min(1).max(8),

  // Opening hours
  hours: openingHoursSchema,

  // Theme (Hybrid stylowe — preset + variant + optional overrides) Track 26 round 3
  theme: z.object({
    preset: z.enum(THEME_PRESETS),
    variant: z.string().min(1).max(40),
    /** Optional override for hero layout (defaults to theme's defaultHero). */
    heroVariant: z.enum(["centered", "split", "image-bg", "asymmetric"]).optional(),
    /** Optional override for accent style (defaults to theme's defaultAccent). */
    accent: z.enum(["bold", "soft", "outline"]).optional(),
    /** Optional logo URL (uploaded to R2 by wizard, served via CDN). */
    logoUrl: z.string().url().optional(),
    /** Optional brand color override (HEX). Auto-generates accent via Material Color Utilities. */
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Brand color must be hex like #c0392b").optional(),
    /** Optional accent color override (HEX). */
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be hex like #f39c12").optional(),
    /** Font pair index from registry (0 = default). */
    fontPairIdx: z.number().int().min(0).max(5).default(0),
    /** Dark mode preference: auto = follow prefers-color-scheme, light/dark = forced. */
    mode: z.enum(["auto", "light", "dark"]).default("auto"),
  }),

  // Domain + SEO
  domain: z.object({
    primary: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/),
    canonicalScheme: z.literal("https").default("https"),
  }),

  // Integrations
  integrations: integrationsSchema,

  // Reviews seed (initial; later updated by GBP cron in hub)
  reviews: z.array(reviewSchema).max(50).optional(),

  // Compliance
  rodo: z.object({
    consentVersion: z.string().regex(/^v\d+\.\d+$/).default("v1.0"),
    privacyPolicyUrl: z.string().url().optional(),
    termsUrl: z.string().url().optional(),
    dpaSigned: z.boolean().default(false),
  }),

  // Optional sections — page builder (Track 26 X.3)
  // Order in array = render order on /. Klient controls toggle + reorder via /ustawienia.
  // Professional tier kinds: publications, trust-badges, consultation (X.5)
  sections: z.array(z.object({
    kind: z.enum([
      "pricing", "team", "history", "video", "gallery", "menu",
      "publications", "trust-badges", "consultation",
    ]),
    enabled: z.boolean().default(true),
    config: z.record(z.unknown()).optional(),
  })).max(15).optional(),
});

export type ClientConfig = z.infer<typeof clientConfigSchema>;

/**
 * Validate a config object — throws on invalid. Used in build step.
 */
export function validateClientConfig(input: unknown): ClientConfig {
  const result = clientConfigSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");
    console.error("[client.config] Validation failed:", issues);
    throw new Error(`Invalid client.config: ${issues}`);
  }
  return result.data;
}
