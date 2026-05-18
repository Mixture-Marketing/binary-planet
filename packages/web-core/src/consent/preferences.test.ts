import { describe, expect, it } from "vitest";

import { preferencesModalCss, preferencesModalHtml } from "./preferences.js";

describe("preferencesModalHtml", () => {
  it("renders modal with role=dialog aria-modal", () => {
    const html = preferencesModalHtml();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="mm-consent-modal-heading"');
  });

  it("contains 4 categories", () => {
    const html = preferencesModalHtml();
    expect(html).toContain('data-mm-consent-category="necessary"');
    expect(html).toContain('data-mm-consent-category="analytics"');
    expect(html).toContain('data-mm-consent-category="marketing"');
    expect(html).toContain('data-mm-consent-category="personalization"');
  });

  it("necessary category is disabled (always on)", () => {
    const html = preferencesModalHtml();
    expect(html).toMatch(/data-mm-consent-category="necessary"\s+checked\s+disabled/);
  });

  it("supports English locale", () => {
    const html = preferencesModalHtml({ lang: "en" });
    expect(html).toContain("Cookie settings");
    expect(html).toContain("Necessary");
    expect(html).toContain("Save selection");
  });

  it("each category shows signal codes", () => {
    const html = preferencesModalHtml();
    // marketing → ad_storage, ad_user_data
    expect(html).toMatch(/marketing[\s\S]*?ad_storage/);
    // analytics → analytics_storage
    expect(html).toMatch(/analytics[\s\S]*?analytics_storage/);
  });

  it("save + accept-all actions present", () => {
    const html = preferencesModalHtml();
    expect(html).toContain('data-mm-consent-action="save-preferences"');
    expect(html).toContain('data-mm-consent-action="accept"');
  });

  it("custom category descriptions override", () => {
    const html = preferencesModalHtml({
      categoryDescriptions: { analytics: "Custom analytics description" },
    });
    expect(html).toContain("Custom analytics description");
  });
});

describe("preferencesModalCss", () => {
  it("contains modal-specific selectors", () => {
    const css = preferencesModalCss();
    expect(css).toContain("#mm-consent-modal");
    expect(css).toContain("toggle-slider");
  });

  it("custom brand color used in toggle :checked + button", () => {
    const css = preferencesModalCss({ brandColor: "#deadbe" });
    expect(css).toContain("#deadbe");
  });
});
