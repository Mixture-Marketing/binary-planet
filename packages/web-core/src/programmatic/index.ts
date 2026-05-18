/**
 * @mixturemarketing/web-core/programmatic
 *
 * Programmatic page generation: service × location pages with HCU-safe guard rails.
 *
 * Reference: plan/00-main.md "Faza 1, krytyczny plik #2", plan/U-final-decisions-v5.md
 *
 * Quick start:
 *   import {
 *     generateProgrammaticPages,
 *     assertProgrammaticQuality,
 *     formatReport,
 *   } from "@mixturemarketing/web-core/programmatic";
 *
 *   const result = await generateProgrammaticPages({
 *     services: clientConfig.services,
 *     locations: clientConfig.location.serviceArea,
 *     slotProvider: async (combo) => ({
 *       title: ...,
 *       description: ...,
 *       h1: ...,
 *       hero: ...,
 *       body: ...,
 *       faqs: [...],          // ≥3 required
 *       testimonials: [...],  // ≥3 required
 *       landmarks: [...],     // ≥1 required
 *       ctaText: "Zadzwoń",
 *     }),
 *   });
 *
 *   console.log(formatReport(result));
 *   assertProgrammaticQuality(result);  // throws on errors
 */

export const MODULE_NAME = "programmatic" as const;

// Main entry
export { generateProgrammaticPages } from "./engine.js";

// Linter
export { assertProgrammaticQuality, formatReport, ProgrammaticQualityError } from "./linter.js";

// Sub-functions (for advanced composition)
export { buildCombos, buildSlug, findDuplicateSlugs, slugifyPolish } from "./combos.js";
export type { BuildCombosInput, BuildCombosOutput } from "./combos.js";

export { countWords, lintPage, totalWordCount } from "./quality.js";
export type { LintPageInput } from "./quality.js";

export { jaccardSimilarity, pairwiseSimilarity, shingles, textSimilarity, tokenize } from "./similarity.js";
export type { SimilarityPair } from "./similarity.js";

// Types
export { DEFAULT_THRESHOLDS } from "./types.js";
export type {
  GenerateInput,
  GenerateOutput,
  LocationInput,
  PageCombo,
  PageOutput,
  ProgrammaticSlots,
  QualityIssue,
  QualityIssueCode,
  QualityThresholds,
  ServiceInput,
  SlotProvider,
} from "./types.js";
