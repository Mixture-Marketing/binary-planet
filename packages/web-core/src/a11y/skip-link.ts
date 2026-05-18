/**
 * Skip link — first focusable element on the page. Allows keyboard users
 * to bypass repeated navigation and jump straight to <main>.
 *
 * WCAG 2.4.1 Bypass Blocks — REQUIRED for AA compliance.
 *
 * Convention:
 *   - First child of <body>
 *   - href targets element with matching id (usually #main)
 *   - Hidden via off-screen position UNTIL focused, then visible
 */

import type { HtmlSnippet } from "./types.js";

export interface SkipLinkOptions {
  /** Target element id (without "#"). Default "main". */
  targetId?: string;
  /** Visible link text. Default "Przejdź do treści głównej". */
  label?: string;
  /** Background color. Default "var(--color-brand, #c0392b)". */
  bg?: string;
  /** Foreground color. Default "white". */
  fg?: string;
}

/**
 * Build skip link as HTML + CSS snippet.
 *
 * @example
 *   const { html, css } = skipLink();
 *   // Astro:
 *   <style>{css}</style>
 *   <body>
 *     <Fragment set:html={html} />
 *     <main id="main">...</main>
 *   </body>
 */
export function skipLink(options: SkipLinkOptions = {}): HtmlSnippet {
  const targetId = options.targetId ?? "main";
  const label = options.label ?? "Przejdź do treści głównej";
  const bg = options.bg ?? "var(--color-brand, #c0392b)";
  const fg = options.fg ?? "white";

  const html = `<a href="#${encodeURIComponent(targetId)}" class="skip-link">${escapeHtml(label)}</a>`;

  const css = `
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: ${bg};
  color: ${fg};
  padding: 1rem 1.5rem;
  z-index: 9999;
  font-weight: 600;
  text-decoration: none;
  border-radius: 0 0 0.5rem 0;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
  outline: 3px solid ${fg};
  outline-offset: 2px;
}
`.trim();

  return { html, css };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
