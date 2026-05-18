/**
 * Cookie preferences modal — granular per-category controls.
 *
 * Opens when user clicks "Dostosuj" on banner OR "Ustawienia cookie" in footer.
 * Allows per-category toggle (necessary/analytics/marketing/personalization).
 *
 * A11y:
 *   - role="dialog" aria-modal="true"
 *   - Focus trapped while open
 *   - Esc closes (treats as "Zapisz tylko niezbędne")
 *   - Each toggle has visible label + describes signals affected
 */

import { CATEGORY_TO_SIGNALS, type ConsentCategory } from "./types.js";

export interface PreferencesModalOptions {
  /** UI language. Default "pl". */
  lang?: "pl" | "en";
  /** Brand color. Default uses var(--color-brand). */
  brandColor?: string;
  /** Custom category descriptions override. */
  categoryDescriptions?: Partial<Record<ConsentCategory, string>>;
}

const CATEGORY_LABELS = {
  pl: {
    heading: "Ustawienia plików cookie",
    description:
      "Zarządzaj poszczególnymi kategoriami plików. Niezbędne są wymagane do działania witryny. Pozostałe możesz włączać i wyłączać.",
    save: "Zapisz wybór",
    acceptAll: "Akceptuj wszystkie",
    close: "Zamknij",
    necessary: { name: "Niezbędne", description: "Wymagane do działania witryny (sesja, koszyk, formularze). Nie można wyłączyć." },
    analytics: { name: "Analityczne", description: "Pomagają zrozumieć jak korzystasz ze strony (statystyki odwiedzin, popularne treści)." },
    marketing: { name: "Marketingowe", description: "Umożliwiają dopasowanie reklam i mierzenie ich skuteczności (Google Ads, Facebook Pixel)." },
    personalization: { name: "Personalizacja", description: "Pozwalają personalizować treści i oferty na podstawie zainteresowań." },
  },
  en: {
    heading: "Cookie settings",
    description:
      "Manage individual cookie categories. Necessary cookies are required for the site to function. Toggle others on/off.",
    save: "Save selection",
    acceptAll: "Accept all",
    close: "Close",
    necessary: { name: "Necessary", description: "Required for the site to function. Cannot be disabled." },
    analytics: { name: "Analytics", description: "Help us understand how you use the site (visit stats, popular content)." },
    marketing: { name: "Marketing", description: "Enable ad personalization and effectiveness measurement (Google Ads, Facebook Pixel)." },
    personalization: { name: "Personalization", description: "Allow personalized content and offers based on interests." },
  },
} as const;

export function preferencesModalHtml(options: PreferencesModalOptions = {}): string {
  const lang = options.lang ?? "pl";
  const labels = CATEGORY_LABELS[lang];

  const renderCategory = (cat: ConsentCategory): string => {
    const label = labels[cat];
    const disabled = cat === "necessary";
    const signals = CATEGORY_TO_SIGNALS[cat];
    const desc = options.categoryDescriptions?.[cat] ?? label.description;
    return `
<div class="mm-consent-category">
  <label class="mm-consent-toggle">
    <input
      type="checkbox"
      data-mm-consent-category="${escapeAttr(cat)}"
      ${disabled ? "checked disabled" : ""}
      aria-describedby="mm-consent-cat-desc-${escapeAttr(cat)}"
    />
    <span class="mm-consent-toggle-slider" aria-hidden="true"></span>
    <span class="mm-consent-toggle-label">${escapeHtml(label.name)}</span>
  </label>
  <p id="mm-consent-cat-desc-${escapeAttr(cat)}" class="mm-consent-category-desc">${escapeHtml(desc)}</p>
  <p class="mm-consent-category-signals">Sygnały: <code>${signals.join(", ")}</code></p>
</div>`;
  };

  return `<div
  id="mm-consent-modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="mm-consent-modal-heading"
  data-mm-consent-modal
  hidden
>
  <div class="mm-consent-modal-backdrop" data-mm-consent-action="close-modal"></div>
  <div class="mm-consent-modal-content">
    <button
      type="button"
      class="mm-consent-modal-close"
      data-mm-consent-action="close-modal"
      aria-label="${escapeAttr(labels.close)}"
    >×</button>
    <h2 id="mm-consent-modal-heading">${escapeHtml(labels.heading)}</h2>
    <p class="mm-consent-modal-desc">${escapeHtml(labels.description)}</p>
    <div class="mm-consent-categories">
      ${renderCategory("necessary")}
      ${renderCategory("analytics")}
      ${renderCategory("marketing")}
      ${renderCategory("personalization")}
    </div>
    <div class="mm-consent-modal-actions">
      <button type="button" class="mm-consent-btn mm-consent-save" data-mm-consent-action="save-preferences">${escapeHtml(labels.save)}</button>
      <button type="button" class="mm-consent-btn mm-consent-accept" data-mm-consent-action="accept">${escapeHtml(labels.acceptAll)}</button>
    </div>
  </div>
</div>`;
}

export function preferencesModalCss(options: { brandColor?: string } = {}): string {
  const brand = options.brandColor ?? "var(--color-brand, #c0392b)";
  return `
#mm-consent-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
#mm-consent-modal[hidden] {
  display: none !important;
}
.mm-consent-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}
.mm-consent-modal-content {
  position: relative;
  background: white;
  color: #1a1a1a;
  max-width: 36rem;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
  border-radius: 0.75rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.mm-consent-modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #5a5a5a;
}
.mm-consent-modal-content h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.3rem;
}
.mm-consent-modal-desc {
  font-size: 0.95rem;
  color: #5a5a5a;
  margin: 0 0 1.5rem 0;
}
.mm-consent-category {
  padding: 1rem 0;
  border-bottom: 1px solid #e5e0d8;
}
.mm-consent-category:last-of-type {
  border-bottom: none;
}
.mm-consent-toggle {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 1rem;
}
.mm-consent-toggle input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.mm-consent-toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background: #d0d0d0;
  border-radius: 999px;
  transition: background 200ms ease;
  flex-shrink: 0;
}
.mm-consent-toggle-slider::before {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 200ms ease;
}
.mm-consent-toggle input:checked + .mm-consent-toggle-slider {
  background: ${brand};
}
.mm-consent-toggle input:checked + .mm-consent-toggle-slider::before {
  transform: translateX(20px);
}
.mm-consent-toggle input:disabled + .mm-consent-toggle-slider {
  opacity: 0.7;
}
.mm-consent-toggle input:focus-visible + .mm-consent-toggle-slider {
  outline: 3px solid ${brand};
  outline-offset: 2px;
}
.mm-consent-category-desc {
  font-size: 0.9rem;
  color: #5a5a5a;
  margin: 0.5rem 0 0 calc(44px + 0.75rem);
  line-height: 1.5;
}
.mm-consent-category-signals {
  font-size: 0.8rem;
  color: #888;
  margin: 0.25rem 0 0 calc(44px + 0.75rem);
}
.mm-consent-category-signals code {
  background: #f5f5f5;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-size: 0.85em;
}
.mm-consent-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.5rem;
  justify-content: flex-end;
}
.mm-consent-save {
  background: transparent;
  color: ${brand};
  border-color: ${brand};
}
@media (max-width: 640px) {
  .mm-consent-modal-actions {
    flex-direction: column-reverse;
  }
  .mm-consent-btn {
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
