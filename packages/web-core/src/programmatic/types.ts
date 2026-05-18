/**
 * Programmatic page generation types.
 *
 * Reference: plan/00-main.md "Faza 1, krytyczny plik #2", plan/U-final-decisions-v5.md
 * (cap 10 stron na start → 40 po 6 mc validation).
 *
 * HCU rationale (Google Helpful Content Update):
 *   - Thin "city swap" pages are penalized
 *   - Each page MUST have unique elements: local FAQ, real testimonials, landmarks
 *   - Similarity check defends against near-duplicate generation by AI
 */

/**
 * Generic service shape — matches client.config.ts ServiceInput.
 * Engine is config-agnostic, so we use minimal duck-typing here.
 */
export interface ServiceInput {
  slug: string;
  name: string;
  description?: string;
  priceFrom?: string;
  /** Optional importance score 1-10 for prioritization when capping. */
  priority?: number;
}

/**
 * Location shape — typically just a city name string from client.config.serviceArea,
 * but rich objects allow geo coords + priority.
 */
export interface LocationInput {
  /** City / district name shown to users. */
  name: string;
  /** URL slug (lowercase, hyphenated). Auto-derived if absent. */
  slug?: string;
  /** Optional priority 1-10 (higher = more important). Defaults to 5. */
  priority?: number;
  /** Optional centroid coords for distance calculations. */
  latitude?: number;
  longitude?: number;
  /** Display variant: "Rzeszów" vs "Rzeszowie" (locative). Auto-fallback to name. */
  locativeName?: string;
}

/**
 * Service × Location combination — represents one programmatic page to generate.
 */
export interface PageCombo {
  service: ServiceInput;
  location: LocationInput;
  /** URL path for the page, e.g. "/uslugi/awaryjne-otwieranie-zamkow/rzeszow" */
  slug: string;
  /** Composite priority for sorting + cap. Higher = include first. */
  priority: number;
}

/**
 * Content provided by the caller per-combo. Engine validates + lints these.
 *
 * Engine is content-agnostic: caller decides how to produce slots (manual config, AI gen,
 * static template per branża, hybrid). Engine ensures quality + structure.
 */
export interface ProgrammaticSlots {
  /** Page title shown in browser tab + OG. ≤70 chars recommended for SERP. */
  title: string;
  /** Meta description, 120-160 chars. */
  description: string;
  /** Visible H1. Should differ from title (no need to repeat brand). */
  h1: string;
  /** Hero subhead / lead paragraph (1-2 sentences). */
  hero: string;
  /** Main body content in markdown. THE place to be substantive. */
  body: string;
  /** Lokalne FAQ — REQUIRED for HCU: each page needs ≥3 location-specific Q+A. */
  faqs: ReadonlyArray<{ question: string; answer: string }>;
  /** Testimonials seed — REQUIRED ≥3 with author hint that this is local. */
  testimonials: ReadonlyArray<{
    author: string;
    text: string;
    rating: 1 | 2 | 3 | 4 | 5;
    /** Optional date YYYY-MM-DD. */
    date?: string;
  }>;
  /** Local landmarks — REQUIRED ≥1 reference to a real place in the area. */
  landmarks: ReadonlyArray<{
    name: string;
    /** "Obok stadionu, 5 min od centrum" etc. */
    context: string;
  }>;
  /** CTA text for the primary action (call/contact). */
  ctaText: string;
}

/**
 * Quality thresholds. Defaults conservative per plan U.5.
 */
export interface QualityThresholds {
  /** Minimum word count per page body. Plan default: 500. */
  minWordsPerPage: number;
  /** Maximum Jaccard similarity between any two pages (0..1). Plan default: 0.70. */
  maxSimilarityRatio: number;
  /** Required minimum FAQs per page. Plan default: 3. */
  requireFaqs: number;
  /** Required minimum testimonials per page. Plan default: 3. */
  requireTestimonials: number;
  /** Required minimum landmarks per page. Plan default: 1. */
  requireLandmarks: number;
  /** Maximum total pages (cap). Plan default: 10 (Faza 2), 40 (Faza 4+). */
  maxPages: number;
}

export const DEFAULT_THRESHOLDS: QualityThresholds = {
  minWordsPerPage: 500,
  maxSimilarityRatio: 0.7,
  requireFaqs: 3,
  requireTestimonials: 3,
  requireLandmarks: 1,
  maxPages: 10,
};

/**
 * Quality issue — caller decides if it's a hard failure (build break) or warning.
 */
export interface QualityIssue {
  pageSlug: string;
  severity: "error" | "warning";
  code: QualityIssueCode;
  message: string;
  /** Numeric data for context (e.g. actual word count, similarity ratio). */
  data?: Record<string, number | string>;
}

export type QualityIssueCode =
  | "word_count_below_min"
  | "similarity_too_high"
  | "faqs_below_min"
  | "testimonials_below_min"
  | "landmarks_below_min"
  | "title_too_long"
  | "description_out_of_range"
  | "duplicate_slug"
  | "missing_h1"
  | "missing_hero";

export interface PageOutput {
  /** Generated path slug — relative URL. */
  slug: string;
  combo: PageCombo;
  slots: ProgrammaticSlots;
  /** Computed word count for body+faqs+testimonials. */
  wordCount: number;
  /** Other pages this page is most similar to (highest 3 ratios). */
  similarPages: ReadonlyArray<{ slug: string; ratio: number }>;
  /** Issues found during quality lint for THIS page. */
  issues: ReadonlyArray<QualityIssue>;
}

/**
 * Slot provider — caller-supplied function that builds slots for a combo.
 * Can be sync or async (e.g. async if calling AI). Engine awaits all in parallel.
 */
export type SlotProvider = (combo: PageCombo) => Promise<ProgrammaticSlots> | ProgrammaticSlots;

/**
 * Engine input + output.
 */
export interface GenerateInput {
  services: ReadonlyArray<ServiceInput>;
  locations: ReadonlyArray<string | LocationInput>;
  /** Quality thresholds. Defaults per plan U.5. */
  thresholds?: Partial<QualityThresholds>;
  /** Build slot content per combo. */
  slotProvider: SlotProvider;
  /** URL base for combo slug — default "/uslugi". */
  basePath?: string;
}

export interface GenerateOutput {
  /** Pages that passed quality OR have warnings only. */
  pages: ReadonlyArray<PageOutput>;
  /** Pages that failed quality (have at least one 'error' severity issue). */
  failed: ReadonlyArray<PageOutput>;
  /** All issues across all pages, aggregated for reporting. */
  allIssues: ReadonlyArray<QualityIssue>;
  /** Pages that were dropped due to cap (not even attempted). */
  cappedOut: ReadonlyArray<PageCombo>;
  /** Resolved thresholds used. */
  thresholds: QualityThresholds;
}
