/**
 * ARIA landmark roles helper.
 *
 * Landmarks let screen reader users navigate by major sections (Tab + R in NVDA, VO+U in VoiceOver).
 *
 * HTML5 elements have implicit roles:
 *   - <header> in <body>    → role="banner"
 *   - <nav>                  → role="navigation"
 *   - <main>                 → role="main"
 *   - <aside>                → role="complementary"
 *   - <footer> in <body>    → role="contentinfo"
 *   - <section> with name   → role="region"
 *
 * Best practice: use semantic HTML elements. ARIA roles only when HTML element unavailable.
 * This module provides the mapping for cases where you need explicit role="...".
 */

export const LANDMARK_ROLES = {
  /** Page banner — typically site header. Should appear once per page. */
  banner: "banner",
  /** Navigation region. Multiple allowed if uniquely named (aria-label/labelledby). */
  navigation: "navigation",
  /** Primary content region. Should appear once per page. */
  main: "main",
  /** Supporting content related to main. */
  complementary: "complementary",
  /** Page footer — typically copyright, links. Should appear once per page. */
  contentinfo: "contentinfo",
  /** Search functionality. */
  search: "search",
  /** Form region (e.g. login). Only when not in another landmark. */
  form: "form",
  /** Generic region — must have accessible name (aria-label or aria-labelledby). */
  region: "region",
} as const;

export type LandmarkRole = (typeof LANDMARK_ROLES)[keyof typeof LANDMARK_ROLES];

/**
 * Generate HTML landmark attributes.
 *
 * @example
 *   const attrs = landmarkAttrs("navigation", "Główna nawigacja");
 *   // { role: "navigation", "aria-label": "Główna nawigacja" }
 *
 * @example
 *   // Astro:
 *   <nav {...landmarkAttrs("navigation", "Stopka")}>
 */
export function landmarkAttrs(
  role: LandmarkRole,
  ariaLabel?: string,
): Record<string, string> {
  const attrs: Record<string, string> = { role };
  if (ariaLabel) attrs["aria-label"] = ariaLabel;
  return attrs;
}

/**
 * Render landmark attributes as HTML attribute string.
 *
 * @example
 *   <div ${renderAttrs(landmarkAttrs("region", "Filtry"))}>
 */
export function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
