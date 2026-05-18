import { describe, expect, it } from "vitest";

import { consentBannerCss, consentBannerHtml } from "./banner.js";

describe("consentBannerHtml", () => {
  it("renders banner with required ARIA + buttons", () => {
    const html = consentBannerHtml({
      businessName: "Ślusarz Kowalski",
      privacyUrl: "/polityka-prywatnosci",
      version: "v1.0",
    });
    expect(html).toContain('role="dialog"');
    expect(html).toContain("Twoja prywatność");
    expect(html).toContain("Ślusarz Kowalski");
    expect(html).toContain('href="/polityka-prywatnosci"');
    expect(html).toContain('data-mm-consent-action="accept"');
    expect(html).toContain('data-mm-consent-action="reject"');
    expect(html).toContain('data-mm-consent-action="customize"');
    expect(html).toContain('data-version="v1.0"');
    expect(html).toContain("hidden");
  });

  it("supports English locale", () => {
    const html = consentBannerHtml({
      businessName: "Test",
      privacyUrl: "/privacy",
      version: "v1.0",
      lang: "en",
    });
    expect(html).toContain("Your privacy");
    expect(html).toContain("Accept all");
    expect(html).toContain("Essential only");
  });

  it("includes terms link when provided", () => {
    const html = consentBannerHtml({
      businessName: "X",
      privacyUrl: "/privacy",
      termsUrl: "/regulamin",
      version: "v1.0",
    });
    expect(html).toContain('href="/regulamin"');
    expect(html).toContain("Regulamin");
  });

  it("custom heading + description override", () => {
    const html = consentBannerHtml({
      businessName: "X",
      privacyUrl: "/",
      version: "v1.0",
      heading: "Custom",
      description: "Custom desc",
    });
    expect(html).toContain("Custom");
    expect(html).toContain("Custom desc");
  });

  it("escapes user-supplied businessName + URLs", () => {
    const html = consentBannerHtml({
      businessName: '<script>alert("xss")</script>',
      privacyUrl: 'javascript:alert("x")',
      version: "v1.0",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    // javascript: URLs not specifically blocked here (caller validates),
    // but special chars are escaped:
    expect(html).toContain("&quot;");
  });

  it("includes data-version for runtime to read", () => {
    const html = consentBannerHtml({
      businessName: "X",
      privacyUrl: "/",
      version: "v3.5",
    });
    expect(html).toContain('data-version="v3.5"');
  });
});

describe("consentBannerCss", () => {
  it("produces non-empty CSS", () => {
    const css = consentBannerCss();
    expect(css.length).toBeGreaterThan(100);
    expect(css).toContain("#mm-consent-banner");
  });

  it("uses default brand var when none provided", () => {
    expect(consentBannerCss()).toContain("var(--color-brand");
  });

  it("uses custom brand color override", () => {
    const css = consentBannerCss({ brandColor: "#abc123" });
    expect(css).toContain("#abc123");
  });

  it("includes focus-visible style for a11y", () => {
    expect(consentBannerCss()).toContain("focus-visible");
  });

  it("has responsive @media breakpoint", () => {
    expect(consentBannerCss()).toContain("@media");
  });
});
