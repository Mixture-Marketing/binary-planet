/**
 * Accessible breadcrumb HTML builder.
 *
 * Pairs with @mixturemarketing/web-core/seo.breadcrumbSchema (JSON-LD).
 *
 * ARIA pattern (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/):
 *   - <nav aria-label="breadcrumb">
 *   - <ol> with list items
 *   - Last item has aria-current="page", no link
 *   - Separator hidden from screen readers (aria-hidden)
 */

export interface BreadcrumbItem {
  /** Display name. */
  name: string;
  /** URL — omit for the current (last) item. */
  url?: string;
}

export interface BuildBreadcrumbOptions {
  /** Optional label override. Default "breadcrumb". */
  ariaLabel?: string;
  /** Separator character between items. Default "/". */
  separator?: string;
}

/**
 * Build semantic + accessible breadcrumb HTML.
 *
 * @example
 *   const html = buildBreadcrumbHtml([
 *     { name: "Strona główna", url: "/" },
 *     { name: "Oferta", url: "/oferta" },
 *     { name: "Otwieranie zamków" },  // current page
 *   ]);
 */
export function buildBreadcrumbHtml(
  items: ReadonlyArray<BreadcrumbItem>,
  options: BuildBreadcrumbOptions = {},
): string {
  if (items.length < 2) {
    throw new Error("buildBreadcrumbHtml: at least 2 items required (breadcrumbs of 1 are useless)");
  }

  const ariaLabel = options.ariaLabel ?? "breadcrumb";
  const separator = options.separator ?? "/";
  const sepHtml = `<span aria-hidden="true" class="breadcrumb-sep"> ${escapeHtml(separator)} </span>`;

  const liEls = items.map((item, idx) => {
    const isLast = idx === items.length - 1;
    const sep = isLast ? "" : sepHtml;
    if (isLast || !item.url) {
      return `<li class="breadcrumb-item breadcrumb-current"><span aria-current="page">${escapeHtml(item.name)}</span>${sep}</li>`;
    }
    return `<li class="breadcrumb-item"><a href="${escapeAttr(item.url)}">${escapeHtml(item.name)}</a>${sep}</li>`;
  });

  return `<nav aria-label="${escapeAttr(ariaLabel)}" class="breadcrumb"><ol class="breadcrumb-list">${liEls.join("")}</ol></nav>`;
}

/**
 * Companion CSS for default styling. Inject once per layout.
 */
export const BREADCRUMB_CSS = `
.breadcrumb {
  font-size: 0.9rem;
}
.breadcrumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
}
.breadcrumb-item {
  display: flex;
  align-items: center;
}
.breadcrumb-item a {
  color: inherit;
  text-decoration: underline;
}
.breadcrumb-current {
  font-weight: 600;
}
.breadcrumb-sep {
  margin: 0 0.5rem;
  opacity: 0.5;
}
`.trim();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
