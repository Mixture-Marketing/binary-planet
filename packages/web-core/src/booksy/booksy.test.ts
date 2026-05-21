import { describe, expect, it } from "vitest";

import { buildBooksyHtml } from "./index.js";

describe("booksy — buildBooksyHtml", () => {
  it("returns empty string when bookingUrl missing", () => {
    expect(buildBooksyHtml({ bookingUrl: "", brandColor: "#000" })).toBe("");
  });

  it("renders sticky CTA with booking URL", () => {
    const html = buildBooksyHtml({
      bookingUrl: "https://booksy.com/pl/123-test",
      brandColor: "#047857",
    });
    expect(html).toContain('id="mm-booksy"');
    expect(html).toContain("https://booksy.com/pl/123-test");
    expect(html).toContain("Zarezerwuj wizytę");
  });

  it("uses custom CTA label", () => {
    const html = buildBooksyHtml({
      bookingUrl: "https://booksy.com/test",
      ctaLabel: "Umów wizytę",
      brandColor: "#000",
    });
    expect(html).toContain("Umów wizytę");
    expect(html).not.toContain("Zarezerwuj wizytę");
  });

  it("defaults to sticky mode", () => {
    const html = buildBooksyHtml({
      bookingUrl: "https://booksy.com/test",
      brandColor: "#000",
    });
    expect(html).toMatch(/"mode":"sticky"/);
  });

  it("supports modal mode (renders iframe)", () => {
    const html = buildBooksyHtml({
      bookingUrl: "https://booksy.com/test",
      brandColor: "#000",
      mode: "modal",
    });
    expect(html).toMatch(/"mode":"modal"/);
  });
});
