/**
 * Ornament SVG paths — for Magazynowy + Elegancki styles.
 *
 * Custom SVG ornaments designed to scale at any size (viewBox 0 0 100 24).
 * Use `currentColor` for stroke/fill so ornaments inherit text color.
 *
 * Decision (2026-05-20): mix custom + SVG Repo CC0. See design-briefs/00-master-design-system.md.
 *
 * Usage:
 *   import { ORNAMENT_PATHS, type OrnamentName } from "@mixturemarketing/web-core/ornaments";
 *   <svg viewBox="0 0 100 24" set:html={ORNAMENT_PATHS["divider-fleuron"]} />
 */

export const ORNAMENT_PATHS = {
  // -------------------------------------------------------------------------
  // Horizontal dividers (between sections / paragraphs)
  // -------------------------------------------------------------------------

  /** Three dots horizontal centered. Subtle, universal. */
  "divider-3-dots": `
    <circle cx="42" cy="12" r="1.5" fill="currentColor" />
    <circle cx="50" cy="12" r="1.5" fill="currentColor" />
    <circle cx="58" cy="12" r="1.5" fill="currentColor" />
  `,

  /** Hairline with diamond in center. Editorial classic. */
  "divider-diamond": `
    <line x1="10" y1="12" x2="42" y2="12" stroke="currentColor" stroke-width="0.5" />
    <path d="M50 6 L54 12 L50 18 L46 12 Z" fill="currentColor" />
    <line x1="58" y1="12" x2="90" y2="12" stroke="currentColor" stroke-width="0.5" />
  `,

  /** Fleuron-style center ornament with hairlines. Magazine signature. */
  "divider-fleuron": `
    <line x1="5" y1="12" x2="35" y2="12" stroke="currentColor" stroke-width="0.5" />
    <path d="M50 6 C 47 8, 45 10, 45 12 C 45 14, 47 16, 50 18 C 53 16, 55 14, 55 12 C 55 10, 53 8, 50 6 Z" fill="none" stroke="currentColor" stroke-width="0.6" />
    <circle cx="50" cy="12" r="1" fill="currentColor" />
    <line x1="65" y1="12" x2="95" y2="12" stroke="currentColor" stroke-width="0.5" />
  `,

  /** Asterism: three asterisks in triangle. Used between chapters. */
  "divider-asterism": `
    <text x="50" y="16" text-anchor="middle" font-family="serif" font-size="10" fill="currentColor">⁂</text>
  `,

  /** Long hairline only (subtle separator). */
  "divider-hairline": `
    <line x1="0" y1="12" x2="100" y2="12" stroke="currentColor" stroke-width="0.5" />
  `,

  // -------------------------------------------------------------------------
  // Decorative elements (corners, accents, quote marks)
  // -------------------------------------------------------------------------

  /** Large opening quote mark for pull quotes. */
  "quote-open": `
    <text x="0" y="20" font-family="serif" font-size="32" font-style="italic" fill="currentColor">"</text>
  `,

  /** Fine 5-point star (reviews, ratings). */
  "star-fine": `
    <path d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z" fill="currentColor" stroke="currentColor" stroke-width="0.5" />
  `,

  /** Ornamental arrow (instead of utility chevron). */
  "arrow-flourish": `
    <path d="M0 12 L80 12" stroke="currentColor" stroke-width="0.5" fill="none" />
    <path d="M75 6 C 80 10, 85 12, 90 12 C 85 12, 80 14, 75 18" fill="none" stroke="currentColor" stroke-width="0.5" />
  `,

  /** Corner flourish (top-left of card). Mirror via transform. */
  "corner-flourish": `
    <path d="M2 22 C 2 14, 8 8, 16 8 L 22 8" stroke="currentColor" stroke-width="0.6" fill="none" />
    <circle cx="22" cy="8" r="1" fill="currentColor" />
  `,
} as const;

export type OrnamentName = keyof typeof ORNAMENT_PATHS;

export const ORNAMENT_NAMES = Object.keys(ORNAMENT_PATHS) as readonly OrnamentName[];

/**
 * Recommended ornament per style preset.
 */
export const STYLE_DEFAULT_ORNAMENT: Record<string, OrnamentName> = {
  minimalist: "divider-hairline",
  elegant: "divider-fleuron",
  dynamic: "divider-hairline", // Dynamic rarely uses ornaments
  editorial: "divider-fleuron",
};
