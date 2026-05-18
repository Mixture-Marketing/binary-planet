/**
 * Visually-hidden ("screen reader only") utility.
 *
 * Use case: content visible to screen readers but NOT visually rendered.
 * Common patterns:
 *   - `<span class="sr-only">Otwórz menu</span>` next to icon
 *   - `<h2 class="sr-only">Filtr produktów</h2>` for landmark structure
 *   - Skip link before being focused
 *
 * Why not display:none? Screen readers skip display:none. We need the content readable.
 * Why not visibility:hidden? Same problem.
 *
 * The "clip" technique is WCAG-recommended:
 * https://www.a11yproject.com/posts/how-to-hide-content/
 */

/**
 * CSS for the .sr-only / .visually-hidden class.
 * Include once in global CSS (or scoped per layout).
 */
export const VISUALLY_HIDDEN_CSS = `
.sr-only,
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only-focusable:not(:focus):not(:focus-within),
.visually-hidden-focusable:not(:focus):not(:focus-within) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`.trim();

export const SR_ONLY_CLASS = "sr-only" as const;

/**
 * Generate a `<span class="sr-only">text</span>` snippet.
 * Use when wrapping text in JSX/Astro is awkward.
 */
export function visuallyHidden(text: string): string {
  return `<span class="${SR_ONLY_CLASS}">${escapeHtml(text)}</span>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
