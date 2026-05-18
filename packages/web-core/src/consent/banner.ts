/**
 * Cookie consent banner HTML/CSS builder.
 *
 * Renders banner shown on first visit (no cookie OR version mismatch).
 *
 * UX:
 *   - Fixed bottom of viewport
 *   - 3 primary buttons: "Akceptuj wszystkie", "Tylko niezbędne", "Dostosuj"
 *   - Link to privacy policy
 *   - "Dostosuj" opens preferences modal (separate component)
 *   - Responsive: stacks vertically on mobile
 *
 * A11y:
 *   - role="dialog" aria-labelledby on banner
 *   - Focus trapped within banner until decision
 *   - Esc key acts as "Tylko niezbędne"
 */

export interface ConsentBannerOptions {
  /** Business name for banner copy. */
  businessName: string;
  /** Privacy policy URL. */
  privacyUrl: string;
  /** Terms URL — optional. */
  termsUrl?: string;
  /** Consent text version — stored in cookie + audit log. */
  version: string;
  /** UI language. Default "pl". */
  lang?: "pl" | "en";
  /** Brand color for primary buttons. Default uses var(--color-brand). */
  brandColor?: string;
  /** Custom heading override. */
  heading?: string;
  /** Custom description override. */
  description?: string;
}

const COPY = {
  pl: {
    heading: "Twoja prywatność",
    description: (business: string) =>
      `Strona ${business} używa plików cookie. Niezbędne pliki służą do działania witryny. Pozostałe pomagają zrozumieć jak korzystasz ze strony i dostarczać dopasowane treści. Możesz zmienić ustawienia w każdej chwili.`,
    acceptAll: "Akceptuj wszystkie",
    rejectAll: "Tylko niezbędne",
    customize: "Dostosuj",
    privacyLabel: "Polityka prywatności",
    termsLabel: "Regulamin",
  },
  en: {
    heading: "Your privacy",
    description: (business: string) =>
      `The ${business} website uses cookies. Essential cookies are required. Others help us understand usage and deliver tailored content. Change preferences anytime.`,
    acceptAll: "Accept all",
    rejectAll: "Essential only",
    customize: "Customize",
    privacyLabel: "Privacy policy",
    termsLabel: "Terms",
  },
} as const;

/**
 * Render banner HTML. Hidden by default (display:none) — script reveals if no consent yet.
 */
export function consentBannerHtml(options: ConsentBannerOptions): string {
  const lang = options.lang ?? "pl";
  const copy = COPY[lang];
  const heading = options.heading ?? copy.heading;
  const description = options.description ?? copy.description(options.businessName);

  return `<div
  id="mm-consent-banner"
  role="dialog"
  aria-labelledby="mm-consent-heading"
  aria-describedby="mm-consent-desc"
  data-mm-consent-banner
  data-version="${escapeAttr(options.version)}"
  hidden
>
  <div class="mm-consent-card">
    <h2 id="mm-consent-heading">${escapeHtml(heading)}</h2>
    <p id="mm-consent-desc">${escapeHtml(description)}</p>
    <div class="mm-consent-links">
      <a href="${escapeAttr(options.privacyUrl)}">${escapeHtml(copy.privacyLabel)}</a>${options.termsUrl ? ` · <a href="${escapeAttr(options.termsUrl)}">${escapeHtml(copy.termsLabel)}</a>` : ""}
    </div>
    <div class="mm-consent-actions">
      <button type="button" class="mm-consent-btn mm-consent-customize" data-mm-consent-action="customize">${escapeHtml(copy.customize)}</button>
      <button type="button" class="mm-consent-btn mm-consent-reject" data-mm-consent-action="reject">${escapeHtml(copy.rejectAll)}</button>
      <button type="button" class="mm-consent-btn mm-consent-accept" data-mm-consent-action="accept">${escapeHtml(copy.acceptAll)}</button>
    </div>
  </div>
</div>`;
}

/**
 * Default banner CSS — scoped via #mm-consent-banner.
 * Override colors via brandColor option in CSS gen below.
 */
export function consentBannerCss(options: { brandColor?: string } = {}): string {
  const brand = options.brandColor ?? "var(--color-brand, #c0392b)";
  return `
#mm-consent-banner {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 9999;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
}
#mm-consent-banner[hidden] {
  display: none !important;
}
#mm-consent-banner .mm-consent-card {
  background: white;
  color: #1a1a1a;
  max-width: 56rem;
  padding: 1.5rem;
  border-radius: 0.75rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  width: 100%;
}
#mm-consent-banner h2 {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
}
#mm-consent-banner p {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  line-height: 1.5;
}
#mm-consent-banner .mm-consent-links {
  font-size: 0.85rem;
  margin: 0 0 1.25rem 0;
  color: #5a5a5a;
}
#mm-consent-banner .mm-consent-links a {
  color: inherit;
  text-decoration: underline;
}
#mm-consent-banner .mm-consent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}
#mm-consent-banner .mm-consent-btn {
  padding: 0.625rem 1.25rem;
  font: inherit;
  font-weight: 600;
  border-radius: 0.375rem;
  border: 2px solid transparent;
  cursor: pointer;
  min-height: 44px;
}
#mm-consent-banner .mm-consent-customize {
  background: transparent;
  color: #1a1a1a;
  border-color: #d0d0d0;
}
#mm-consent-banner .mm-consent-reject {
  background: transparent;
  color: ${brand};
  border-color: ${brand};
}
#mm-consent-banner .mm-consent-accept {
  background: ${brand};
  color: white;
}
#mm-consent-banner .mm-consent-btn:focus-visible {
  outline: 3px solid ${brand};
  outline-offset: 2px;
}
@media (max-width: 640px) {
  #mm-consent-banner .mm-consent-actions {
    flex-direction: column-reverse;
  }
  #mm-consent-banner .mm-consent-btn {
    width: 100%;
  }
}
`.trim();
}

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
