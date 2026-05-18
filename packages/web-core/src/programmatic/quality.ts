/**
 * Per-page quality lint — checks elements that don't require cross-page state.
 * Cross-page similarity is computed separately in the engine using similarity.ts.
 */

import { tokenize } from "./similarity.js";
import type {
  ProgrammaticSlots,
  QualityIssue,
  QualityIssueCode,
  QualityThresholds,
} from "./types.js";

/** Count words in a string. Strips markdown for accurate count. */
export function countWords(text: string): number {
  // Strip code fences (Java/C# samples shouldn't inflate count)
  const stripped = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ") // image refs
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1"); // link text only
  return tokenize(stripped).length;
}

/**
 * Compute total word count across body + faqs + testimonials.
 * Hero/title/H1 excluded (too short to matter, and they're variable).
 */
export function totalWordCount(slots: ProgrammaticSlots): number {
  const faqText = slots.faqs.map((f) => `${f.question} ${f.answer}`).join(" ");
  const testimonialText = slots.testimonials.map((t) => t.text).join(" ");
  return countWords(`${slots.body} ${faqText} ${testimonialText}`);
}

export interface LintPageInput {
  slug: string;
  slots: ProgrammaticSlots;
  thresholds: QualityThresholds;
}

/**
 * Per-page quality checks (no cross-page state).
 * Returns array of issues — empty array means perfect.
 */
export function lintPage(input: LintPageInput): { issues: QualityIssue[]; wordCount: number } {
  const issues: QualityIssue[] = [];
  const { slug, slots, thresholds } = input;
  const wordCount = totalWordCount(slots);

  if (wordCount < thresholds.minWordsPerPage) {
    issues.push(
      mkIssue(slug, "error", "word_count_below_min", `Page has ${wordCount} words, minimum is ${thresholds.minWordsPerPage}`, {
        actual: wordCount,
        required: thresholds.minWordsPerPage,
      }),
    );
  }

  if (slots.faqs.length < thresholds.requireFaqs) {
    issues.push(
      mkIssue(
        slug,
        "error",
        "faqs_below_min",
        `Page has ${slots.faqs.length} FAQs, minimum is ${thresholds.requireFaqs}`,
        { actual: slots.faqs.length, required: thresholds.requireFaqs },
      ),
    );
  }

  if (slots.testimonials.length < thresholds.requireTestimonials) {
    issues.push(
      mkIssue(
        slug,
        "error",
        "testimonials_below_min",
        `Page has ${slots.testimonials.length} testimonials, minimum is ${thresholds.requireTestimonials}`,
        { actual: slots.testimonials.length, required: thresholds.requireTestimonials },
      ),
    );
  }

  if (slots.landmarks.length < thresholds.requireLandmarks) {
    issues.push(
      mkIssue(
        slug,
        "error",
        "landmarks_below_min",
        `Page has ${slots.landmarks.length} landmarks, minimum is ${thresholds.requireLandmarks}`,
        { actual: slots.landmarks.length, required: thresholds.requireLandmarks },
      ),
    );
  }

  if (!slots.h1 || slots.h1.trim().length === 0) {
    issues.push(mkIssue(slug, "error", "missing_h1", "Page is missing H1"));
  }

  if (!slots.hero || slots.hero.trim().length === 0) {
    issues.push(mkIssue(slug, "warning", "missing_hero", "Page is missing hero text"));
  }

  // SEO metadata sanity
  if (slots.title.length > 70) {
    issues.push(
      mkIssue(
        slug,
        "warning",
        "title_too_long",
        `Title is ${slots.title.length} chars (SERP truncates around 60-70)`,
        { actual: slots.title.length, recommended_max: 70 },
      ),
    );
  }

  const descLen = slots.description.length;
  if (descLen < 120 || descLen > 160) {
    issues.push(
      mkIssue(
        slug,
        "warning",
        "description_out_of_range",
        `Description is ${descLen} chars (recommended 120-160)`,
        { actual: descLen, recommended_min: 120, recommended_max: 160 },
      ),
    );
  }

  return { issues, wordCount };
}

function mkIssue(
  pageSlug: string,
  severity: "error" | "warning",
  code: QualityIssueCode,
  message: string,
  data?: Record<string, number | string>,
): QualityIssue {
  const issue: QualityIssue = { pageSlug, severity, code, message };
  if (data) issue.data = data;
  return issue;
}
