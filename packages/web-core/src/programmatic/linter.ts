/**
 * CI lint helper. Wrap engine output for build-time enforcement:
 *
 *   const result = await generateProgrammaticPages({...});
 *   assertProgrammaticQuality(result);  // throws if any 'error' severity issue
 *
 * Use as the final step in `mm-starter` build pipeline (Astro hook OR pre-deploy script).
 */

import type { GenerateOutput, QualityIssue } from "./types.js";

export class ProgrammaticQualityError extends Error {
  public readonly errors: ReadonlyArray<QualityIssue>;
  public readonly warnings: ReadonlyArray<QualityIssue>;

  constructor(errors: ReadonlyArray<QualityIssue>, warnings: ReadonlyArray<QualityIssue>) {
    const errorLines = errors
      .map((e) => `  [${e.severity.toUpperCase()}] ${e.pageSlug}: ${e.code} — ${e.message}`)
      .join("\n");
    super(`Programmatic quality check failed (${errors.length} errors):\n${errorLines}`);
    this.name = "ProgrammaticQualityError";
    this.errors = errors;
    this.warnings = warnings;
  }
}

/** Throws ProgrammaticQualityError if any 'error' severity issue exists. */
export function assertProgrammaticQuality(output: GenerateOutput): void {
  const errors = output.allIssues.filter((i) => i.severity === "error");
  const warnings = output.allIssues.filter((i) => i.severity === "warning");
  if (errors.length > 0) {
    throw new ProgrammaticQualityError(errors, warnings);
  }
}

/**
 * Format a human-friendly summary report. For console output / CI logs.
 */
export function formatReport(output: GenerateOutput): string {
  const lines: string[] = [];
  lines.push(`Programmatic Pages Report`);
  lines.push(`========================`);
  lines.push(``);
  lines.push(`Total combos generated: ${output.pages.length + output.failed.length}`);
  lines.push(`  Passed:  ${output.pages.length}`);
  lines.push(`  Failed:  ${output.failed.length}`);
  lines.push(`Capped out (over maxPages=${output.thresholds.maxPages}): ${output.cappedOut.length}`);
  lines.push(``);

  const errors = output.allIssues.filter((i) => i.severity === "error");
  const warnings = output.allIssues.filter((i) => i.severity === "warning");

  if (errors.length === 0 && warnings.length === 0) {
    lines.push(`✅ No quality issues.`);
  }

  if (errors.length > 0) {
    lines.push(`❌ Errors (${errors.length}):`);
    for (const e of errors) {
      lines.push(`  - [${e.pageSlug}] ${e.code}: ${e.message}`);
    }
    lines.push(``);
  }

  if (warnings.length > 0) {
    lines.push(`⚠️  Warnings (${warnings.length}):`);
    for (const w of warnings) {
      lines.push(`  - [${w.pageSlug}] ${w.code}: ${w.message}`);
    }
    lines.push(``);
  }

  // Word count distribution
  if (output.pages.length > 0) {
    const wordCounts = [...output.pages, ...output.failed].map((p) => p.wordCount).sort((a, b) => a - b);
    const min = wordCounts[0]!;
    const max = wordCounts[wordCounts.length - 1]!;
    const median = wordCounts[Math.floor(wordCounts.length / 2)]!;
    lines.push(`Word count: min=${min}, median=${median}, max=${max}`);
  }

  // Similarity peak
  const allSims = [...output.pages, ...output.failed].flatMap((p) => p.similarPages);
  if (allSims.length > 0) {
    const peakSim = allSims.reduce((a, b) => (a.ratio > b.ratio ? a : b));
    lines.push(`Peak similarity: ${(peakSim.ratio * 100).toFixed(0)}% (threshold ${(output.thresholds.maxSimilarityRatio * 100).toFixed(0)}%)`);
  }

  if (output.cappedOut.length > 0) {
    lines.push(``);
    lines.push(`Capped-out combos (lowest priority):`);
    for (const c of output.cappedOut.slice(0, 5)) {
      lines.push(`  - ${c.slug} (priority ${c.priority})`);
    }
    if (output.cappedOut.length > 5) {
      lines.push(`  ... +${output.cappedOut.length - 5} more`);
    }
  }

  return lines.join("\n");
}
