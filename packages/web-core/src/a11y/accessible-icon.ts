/**
 * Accessible icon pattern.
 *
 * Problem: icon-only buttons/links have no text for screen readers.
 * Solution: wrap icon (aria-hidden) + sr-only label.
 *
 * @example
 *   <button>
 *     {accessibleIcon({
 *       icon: '<svg>...</svg>',
 *       label: "Otwórz menu",
 *     })}
 *   </button>
 *
 * Output:
 *   <button>
 *     <span aria-hidden="true"><svg>...</svg></span>
 *     <span class="sr-only">Otwórz menu</span>
 *   </button>
 *
 * For decorative icons (label conveyed elsewhere): use `decorativeIcon(svg)` instead.
 */

import { SR_ONLY_CLASS } from "./visually-hidden.js";

export interface AccessibleIconOptions {
  /** Icon content (SVG, emoji, or character). Will be wrapped in aria-hidden span. */
  icon: string;
  /** Screen reader label. Required for non-decorative icons. */
  label: string;
}

/** Icon + sr-only label pattern. Use for icon-only buttons/links. */
export function accessibleIcon(options: AccessibleIconOptions): string {
  return `<span aria-hidden="true">${options.icon}</span><span class="${SR_ONLY_CLASS}">${escapeHtml(options.label)}</span>`;
}

/**
 * Pure decorative icon — no label (text near it already conveys meaning).
 * Wraps in aria-hidden span to prevent SR from announcing.
 *
 * @example
 *   <button>
 *     {decorativeIcon('<svg>📞</svg>')} Zadzwoń teraz
 *   </button>
 */
export function decorativeIcon(icon: string): string {
  return `<span aria-hidden="true">${icon}</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
